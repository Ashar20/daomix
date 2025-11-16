#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame::pallet]
pub mod pallet {
	use frame::prelude::*;

	/// Configure the pallet by specifying the parameters and types on which it depends.
	#[pallet::config]
	pub trait Config: frame_system::Config {
		#[allow(deprecated)]
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// Maximum jobs allowed to avoid unbounded growth.
		#[pallet::constant]
		type MaxJobs: Get<u32>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(PhantomData<T>);

	/// Type aliases for clarity.
	pub type JobId = u64;

	#[derive(
		Encode, Decode, MaxEncodedLen, TypeInfo, Clone, Copy, Eq, PartialEq, RuntimeDebug,
		DecodeWithMemTracking,
	)]
	pub enum JobStatus {
		Pending,
		Running,
		Completed,
		Failed,
	}

	#[derive(Encode, Decode, MaxEncodedLen, TypeInfo, Clone, Eq, PartialEq, RuntimeDebug)]
	pub struct MixJobInfo<AccountId, BlockNumber> {
		pub job_id: u64,
		pub requester: AccountId,
		pub source_para: Option<u32>,
		pub election_id: u32,
		pub created_at: BlockNumber,
		pub status: JobStatus,
		pub last_update: BlockNumber,
		pub error_code: Option<BoundedVec<u8, ConstU32<256>>>,
	}

	/// Storage: Next job ID counter.
	#[pallet::storage]
	#[pallet::getter(fn next_job_id)]
	pub type NextJobId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// Storage: Jobs mapping JobId → MixJobInfo.
	#[pallet::storage]
	#[pallet::getter(fn jobs)]
	pub type Jobs<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		JobId,
		MixJobInfo<T::AccountId, BlockNumberFor<T>>,
		OptionQuery,
	>;

	/// Storage: Index from ElectionId to last JobId.
	#[pallet::storage]
	#[pallet::getter(fn last_job_for_election)]
	pub type LastJobForElection<T: Config> =
		StorageMap<_, Blake2_128Concat, u32, JobId, OptionQuery>;

	/// Pallets use events to inform users when important changes are made.
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A mixing job was submitted.
		JobSubmitted {
			job_id: JobId,
			election_id: u32,
			requester: T::AccountId,
		},
		/// A job status was updated.
		JobStatusUpdated {
			job_id: JobId,
			old_status: u8,
			new_status: u8,
		},
	}

	/// Errors inform users that something went wrong.
	#[pallet::error]
	pub enum Error<T> {
		/// Job limit reached.
		JobLimitReached,
		/// Job not found.
		JobNotFound,
		/// Invalid status transition.
		InvalidStatusTransition,
	}


	/// Dispatchable functions allows users to interact with the pallet and invoke state changes.
	/// These functions materialize as "extrinsics", which are often compared to transactions.
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Submit a new job for an existing Daomix election.
		///
		/// Only signed extrinsics are allowed.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn submit_job(origin: OriginFor<T>, election_id: u32) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// Enforce MaxJobs limit (simple count is fine for now).
			let max_jobs: u32 = T::MaxJobs::get();
			let current_jobs: u32 = Jobs::<T>::iter_keys().count() as u32;
			ensure!(current_jobs < max_jobs, Error::<T>::JobLimitReached);

			let job_id = NextJobId::<T>::get();
			let next_id = job_id.checked_add(1).ok_or(ArithmeticError::Overflow)?;

			NextJobId::<T>::put(next_id);

			let now = <frame_system::Pallet<T>>::block_number();

			let info = MixJobInfo::<T::AccountId, BlockNumberFor<T>> {
				job_id,
				requester: who.clone(),
				source_para: None,
				election_id,
				created_at: now,
				status: JobStatus::Pending,
				last_update: now,
				error_code: None,
			};

			Jobs::<T>::insert(job_id, info);
			LastJobForElection::<T>::insert(election_id, job_id);

			Self::deposit_event(Event::JobSubmitted {
				job_id,
				election_id,
				requester: who,
			});

			Ok(())
		}

		/// External updater for job status.
		///
		/// Only signed extrinsics are allowed.
		#[pallet::call_index(1)]
		#[pallet::weight(10_000)]
		pub fn update_job_status(
			origin: OriginFor<T>,
			job_id: JobId,
			new_status: JobStatus,
			error_code: Option<BoundedVec<u8, ConstU32<256>>>,
		) -> DispatchResult {
			let _who = ensure_signed(origin)?;

			Jobs::<T>::try_mutate(job_id, |maybe_job| -> DispatchResult {
				let job = maybe_job.as_mut().ok_or(Error::<T>::JobNotFound)?;

				// Allowed status transitions:
				// Pending/Running -> Completed/Failed/Running (no backward moves).
				match (job.status, new_status) {
					(JobStatus::Pending, JobStatus::Pending)
					| (JobStatus::Pending, JobStatus::Running)
					| (JobStatus::Pending, JobStatus::Completed)
					| (JobStatus::Pending, JobStatus::Failed)
					| (JobStatus::Running, JobStatus::Running)
					| (JobStatus::Running, JobStatus::Completed)
					| (JobStatus::Running, JobStatus::Failed) => { /* allowed */ }
					_ => return Err(Error::<T>::InvalidStatusTransition.into()),
				}

				let old_status = job.status;

				job.status = new_status;
				job.last_update = <frame_system::Pallet<T>>::block_number();
				job.error_code = error_code;

				Self::deposit_event(Event::JobStatusUpdated {
					job_id,
					old_status: old_status as u8,
					new_status: job.status as u8,
				});

				Ok(())
			})
		}
	}
}

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;