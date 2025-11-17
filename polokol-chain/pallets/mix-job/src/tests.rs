use crate::{mock::*, Error, Event, JobStatus, Jobs, LastJobForElection, NextJobId};
use frame::testing_prelude::*;

#[test]
fn submit_job_creates_job_and_increments_counter() {
	new_test_ext().execute_with(|| {
		// Go past genesis block so events get deposited.
		System::set_block_number(1);

		// Arrange: start with empty storage
		assert_eq!(NextJobId::<Test>::get(), 0);
		assert_eq!(Jobs::<Test>::iter().count(), 0);
		assert_eq!(LastJobForElection::<Test>::iter().count(), 0);

		// Act: call submit_job(ALICE, 47)
		assert_ok!(MixJob::submit_job(RuntimeOrigin::signed(1), 47));

		// Assert: NextJobId == 1
		assert_eq!(NextJobId::<Test>::get(), 1);

		// Assert: Jobs(0) exists with correct fields
		let job = Jobs::<Test>::get(0).unwrap();
		assert_eq!(job.job_id, 0);
		assert_eq!(job.requester, 1);
		assert_eq!(job.election_id, 47);
		assert_eq!(job.status, JobStatus::Pending);
		assert_eq!(job.error_code, None);

		// Assert: LastJobForElection(47) == 0
		assert_eq!(LastJobForElection::<Test>::get(47), Some(0));

		// Assert: JobSubmitted event fired
		System::assert_last_event(
			Event::JobSubmitted {
				job_id: 0,
				election_id: 47,
				requester: 1,
			}
			.into(),
		);
	});
}

#[test]
fn submit_job_respects_max_jobs_limit() {
	new_test_ext().execute_with(|| {
		// Arrange: create MaxJobs jobs (MaxJobs = 10 in mock)
		for i in 0..10 {
			assert_ok!(MixJob::submit_job(RuntimeOrigin::signed(1), i as u32));
		}
		assert_eq!(Jobs::<Test>::iter().count(), 10);

		// Act: try to submit one more job
		assert_noop!(
			MixJob::submit_job(RuntimeOrigin::signed(1), 100),
			Error::<Test>::JobLimitReached
		);
	});
}

#[test]
fn update_job_status_allows_valid_transitions() {
	new_test_ext().execute_with(|| {
		// Go past genesis block so events get deposited.
		System::set_block_number(1);

		// Arrange: create a job in Pending
		assert_ok!(MixJob::submit_job(RuntimeOrigin::signed(1), 47));
		assert_eq!(Jobs::<Test>::get(0).unwrap().status, JobStatus::Pending);

		// Act: update to Running
		assert_ok!(MixJob::update_job_status(
			RuntimeOrigin::signed(1),
			0,
			JobStatus::Running,
			None
		));

		// Assert: status changed and event fired
		assert_eq!(Jobs::<Test>::get(0).unwrap().status, JobStatus::Running);
		System::assert_last_event(
			Event::JobStatusUpdated {
				job_id: 0,
				old_status: JobStatus::Pending as u8,
				new_status: JobStatus::Running as u8,
			}
			.into(),
		);

		// Act: update to Completed
		assert_ok!(MixJob::update_job_status(
			RuntimeOrigin::signed(1),
			0,
			JobStatus::Completed,
			None
		));

		// Assert: final status and event
		assert_eq!(Jobs::<Test>::get(0).unwrap().status, JobStatus::Completed);
		System::assert_last_event(
			Event::JobStatusUpdated {
				job_id: 0,
				old_status: JobStatus::Running as u8,
				new_status: JobStatus::Completed as u8,
			}
			.into(),
		);
	});
}

#[test]
fn update_job_status_blocks_invalid_transitions() {
	new_test_ext().execute_with(|| {
		// Arrange: create a job and set it to Completed
		assert_ok!(MixJob::submit_job(RuntimeOrigin::signed(1), 47));
		assert_ok!(MixJob::update_job_status(
			RuntimeOrigin::signed(1),
			0,
			JobStatus::Completed,
			None
		));
		assert_eq!(Jobs::<Test>::get(0).unwrap().status, JobStatus::Completed);

		// Act: try to move back to Running (invalid transition)
		assert_noop!(
			MixJob::update_job_status(RuntimeOrigin::signed(1), 0, JobStatus::Running, None),
			Error::<Test>::InvalidStatusTransition
		);

		// Assert: status remains Completed
		assert_eq!(Jobs::<Test>::get(0).unwrap().status, JobStatus::Completed);
	});
}