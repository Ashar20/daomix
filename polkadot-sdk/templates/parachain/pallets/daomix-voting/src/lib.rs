//! # DaoMix Voting Pallet
//!
//! A FRAME pallet for DaoMix-style governance voting with onion-encrypted ballots.
//! This pallet manages elections, voter registration, encrypted ballot storage,
//! mix commitments, and final tally results.

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
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Type aliases for clarity.
	pub type ElectionId = u32;
	pub type BallotIndex = u32;
	pub type Ciphertext = BoundedVec<u8, ConstU32<65536>>; // Stores onion-encrypted ballots (max 64KB)
	pub type RootHash<T> = <T as frame_system::Config>::Hash;

	/// Election metadata stored on-chain.
	#[derive(
		Encode, Decode, MaxEncodedLen, TypeInfo, CloneNoBound, PartialEqNoBound, DebugNoBound,
	)]
	#[scale_info(skip_type_params(T))]
	pub struct Election<T: Config> {
		/// Admin account that created this election.
		pub admin: T::AccountId,
		/// Tally authority account that can submit final results.
		pub tally_authority: T::AccountId,
		/// Block number after which voter registration closes.
		pub registration_deadline: BlockNumberFor<T>,
		/// Block number after which voting closes.
		pub voting_deadline: BlockNumberFor<T>,
		/// Merkle root hash of input ballots (set after mix phase).
		pub commitment_input_root: Option<RootHash<T>>,
		/// Merkle root hash of output ballots after mixing (set after mix phase).
		pub commitment_output_root: Option<RootHash<T>>,
		/// Whether the tally has been finalized.
		pub finalized: bool,
	}

	/// Tally result metadata.
	#[derive(
		Encode, Decode, MaxEncodedLen, TypeInfo, CloneNoBound, PartialEqNoBound, DebugNoBound,
	)]
	#[scale_info(skip_type_params(T))]
	pub struct TallyResult<T: Config> {
		/// URI or location of the full tally result (e.g. IPFS hash, JSON URL).
		pub result_uri: BoundedVec<u8, ConstU32<256>>,
		/// Hash of the full tally JSON/result data.
		pub result_hash: RootHash<T>,
	}

	/// Storage: Elections mapping ElectionId → Election metadata.
	#[pallet::storage]
	#[pallet::getter(fn elections)]
	pub type Elections<T: Config> = StorageMap<_, Blake2_128Concat, ElectionId, Election<T>>;

	/// Storage: Voter registration status.
	/// Double map (ElectionId, AccountId) → bool (registered or not).
	#[pallet::storage]
	#[pallet::getter(fn voters)]
	pub type Voters<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		ElectionId,
		Blake2_128Concat,
		T::AccountId,
		bool,
		ValueQuery,
	>;

	/// Storage: Encrypted ballots.
	/// Double map (ElectionId, BallotIndex) → Ciphertext.
	#[pallet::storage]
	#[pallet::getter(fn ballots)]
	pub type Ballots<T: Config> = StorageDoubleMap<
		_,
		Blake2_128Concat,
		ElectionId,
		Blake2_128Concat,
		BallotIndex,
		Ciphertext,
	>;

	/// Storage: Count of ballots per election.
	/// Map ElectionId → BallotIndex (number of ballots cast).
	#[pallet::storage]
	#[pallet::getter(fn ballot_count)]
	pub type BallotCount<T: Config> = StorageMap<_, Blake2_128Concat, ElectionId, BallotIndex, ValueQuery>;

	/// Storage: Final tally results.
	/// Map ElectionId → TallyResult.
	#[pallet::storage]
	#[pallet::getter(fn tally_results)]
	pub type TallyResults<T: Config> = StorageMap<_, Blake2_128Concat, ElectionId, TallyResult<T>>;

	/// Pallets use events to inform users when important changes are made.
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// An election was created.
		ElectionCreated { election_id: ElectionId },
		/// A voter registered for an election.
		VoterRegistered { election_id: ElectionId, voter: T::AccountId },
		/// A ballot was cast.
		BallotCast { election_id: ElectionId, voter: T::AccountId, index: BallotIndex },
		/// Mix commitments were set for an election.
		MixCommitmentsSet { election_id: ElectionId },
		/// Tally results were submitted for an election.
		TallySubmitted { election_id: ElectionId },
	}

	/// Errors inform users that something went wrong.
	#[pallet::error]
	pub enum Error<T> {
		/// Election not found.
		ElectionNotFound,
		/// Voter is already registered.
		AlreadyRegistered,
		/// Voter is not registered.
		NotRegistered,
		/// Voting period has closed.
		VotingClosed,
		/// Not authorized: caller is not the election admin.
		NotAdmin,
		/// Not authorized: caller is not the tally authority.
		NotTallyAuthority,
		/// Election with this ID already exists.
		ElectionAlreadyExists,
		/// Ciphertext exceeds maximum allowed length.
		CiphertextTooLong,
	}

	#[pallet::hooks]
	impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {}

	/// Dispatchable functions allows users to interact with the pallet and invoke state changes.
	/// These functions materialize as "extrinsics", which are often compared to transactions.
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Create a new election.
		///
		/// Only the admin account that signs this transaction can create an election.
		/// The election ID must be unique.
		#[pallet::call_index(0)]
		#[pallet::weight(10_000)]
		pub fn create_election(
			origin: OriginFor<T>,
			election_id: ElectionId,
			tally_authority: T::AccountId,
			registration_deadline: BlockNumberFor<T>,
			voting_deadline: BlockNumberFor<T>,
		) -> DispatchResult {
			let admin = ensure_signed(origin)?;

			// Ensure election doesn't already exist
			ensure!(!Elections::<T>::contains_key(election_id), Error::<T>::ElectionAlreadyExists);

			// Ensure deadlines are valid
			ensure!(
				registration_deadline < voting_deadline,
				Error::<T>::VotingClosed
			);

			let now = <frame_system::Pallet<T>>::block_number();
			ensure!(registration_deadline > now, Error::<T>::VotingClosed);

			// Create election
			let election = Election {
				admin,
				tally_authority,
				registration_deadline,
				voting_deadline,
				commitment_input_root: None,
				commitment_output_root: None,
				finalized: false,
			};

			Elections::<T>::insert(election_id, &election);
			BallotCount::<T>::insert(election_id, 0);

			Self::deposit_event(Event::ElectionCreated { election_id });

			Ok(())
		}

		/// Register a voter for an election.
		///
		/// Only the election admin can register voters.
		/// Registration must occur before the registration deadline.
		#[pallet::call_index(1)]
		#[pallet::weight(10_000)]
		pub fn register_voter(
			origin: OriginFor<T>,
			election_id: ElectionId,
			voter: T::AccountId,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			let election = Elections::<T>::get(election_id).ok_or(Error::<T>::ElectionNotFound)?;

			// Only admin can register voters
			ensure!(who == election.admin, Error::<T>::NotAdmin);

			// Ensure election is not finalized
			ensure!(!election.finalized, Error::<T>::VotingClosed);

			// Ensure we're still before or at registration deadline
			let now = <frame_system::Pallet<T>>::block_number();
			ensure!(now <= election.registration_deadline, Error::<T>::VotingClosed);

			// Ensure voter is not already registered
			ensure!(
				!Voters::<T>::contains_key(election_id, &voter),
				Error::<T>::AlreadyRegistered
			);

			Voters::<T>::insert(election_id, &voter, true);

			Self::deposit_event(Event::VoterRegistered { election_id, voter });

			Ok(())
		}

		/// Cast an encrypted ballot.
		///
		/// The voter must be registered for this election.
		/// The ballot must be cast before the voting deadline.
		#[pallet::call_index(2)]
		#[pallet::weight(10_000)]
		pub fn cast_vote(
			origin: OriginFor<T>,
			election_id: ElectionId,
			ciphertext: sp_std::vec::Vec<u8>,
		) -> DispatchResult {
			let voter = ensure_signed(origin)?;

			let election = Elections::<T>::get(election_id).ok_or(Error::<T>::ElectionNotFound)?;

			// Ensure election is not finalized and we are in the voting phase
			ensure!(!election.finalized, Error::<T>::VotingClosed);

			let now = <frame_system::Pallet<T>>::block_number();
			ensure!(now <= election.voting_deadline, Error::<T>::VotingClosed);

			// Ensure the signer is registered
			ensure!(
				Voters::<T>::contains_key(election_id, &voter),
				Error::<T>::NotRegistered
			);

			// Convert Vec<u8> to bounded Ciphertext
			let bounded: Ciphertext = ciphertext
				.try_into()
				.map_err(|_| Error::<T>::CiphertextTooLong)?;

			// Get current ballot index
			let index = BallotCount::<T>::get(election_id);

			// Store ballot
			Ballots::<T>::insert(election_id, index, &bounded);

			// Increment ballot count
			BallotCount::<T>::insert(election_id, index.saturating_add(1));

			Self::deposit_event(Event::BallotCast { election_id, voter, index });

			Ok(())
		}

		/// Set mix commitments for an election.
		///
		/// Only the tally authority can set mix commitments.
		/// This should be called after the mixing phase completes.
		#[pallet::call_index(3)]
		#[pallet::weight(10_000)]
		pub fn set_mix_commitments(
			origin: OriginFor<T>,
			election_id: ElectionId,
			commitment_input_root: RootHash<T>,
			commitment_output_root: RootHash<T>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			let mut election =
				Elections::<T>::get(election_id).ok_or(Error::<T>::ElectionNotFound)?;

			// Only tally authority can set commitments
			ensure!(who == election.tally_authority, Error::<T>::NotTallyAuthority);

			// Ensure election is not finalized
			ensure!(!election.finalized, Error::<T>::VotingClosed);

			// Update commitments
			election.commitment_input_root = Some(commitment_input_root);
			election.commitment_output_root = Some(commitment_output_root);

			Elections::<T>::insert(election_id, &election);

			Self::deposit_event(Event::MixCommitmentsSet { election_id });

			Ok(())
		}

		/// Submit final tally results for an election.
		///
		/// Only the tally authority can submit tally results.
		/// This finalizes the election and prevents further modifications.
		#[pallet::call_index(4)]
		#[pallet::weight(10_000)]
		pub fn submit_tally(
			origin: OriginFor<T>,
			election_id: ElectionId,
			result_uri: sp_std::vec::Vec<u8>,
			result_hash: RootHash<T>,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			let mut election =
				Elections::<T>::get(election_id).ok_or(Error::<T>::ElectionNotFound)?;

			// Only tally authority can submit tally
			ensure!(who == election.tally_authority, Error::<T>::NotTallyAuthority);

			// Ensure election is not finalized
			ensure!(!election.finalized, Error::<T>::VotingClosed);

			// Ensure commitments have been set
			ensure!(
				election.commitment_input_root.is_some() &&
					election.commitment_output_root.is_some(),
				Error::<T>::VotingClosed
			);

			// Convert result_uri to bounded vec
			let bounded_uri: BoundedVec<u8, ConstU32<256>> = result_uri
				.try_into()
				.map_err(|_| Error::<T>::CiphertextTooLong)?;

			// Store tally result
			let tally_result = TallyResult {
				result_uri: bounded_uri,
				result_hash,
			};
			TallyResults::<T>::insert(election_id, &tally_result);

			// Finalize election
			election.finalized = true;
			Elections::<T>::insert(election_id, &election);

			Self::deposit_event(Event::TallySubmitted { election_id });

			Ok(())
		}
	}
}

