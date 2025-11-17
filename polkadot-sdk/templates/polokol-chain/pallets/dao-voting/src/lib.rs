#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{
    decl_error, decl_event, decl_module, decl_storage,
    dispatch::{DispatchResult, Weight},
    ensure,
    traits::EnsureOrigin,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::traits::AccountId;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[pallet::pallet]
    #[pallet::generate_store(pub(super) trait Store)]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }

    #[pallet::storage]
    #[pallet::getter(fn next_dao_id)]
    pub type NextDaoId<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn next_proposal_id)]
    pub type NextProposalId<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        DaoCreated { dao_id: u32, creator: T::AccountId },
        ProposalCreated { dao_id: u32, proposal_id: u32, creator: T::AccountId },
        Voted { dao_id: u32, proposal_id: u32, voter: T::AccountId, choice: u8 },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// DAO does not exist
        DaoNotFound,
        /// Proposal does not exist
        ProposalNotFound,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::weight(10_000)]
        pub fn create_dao(origin: OriginFor<T>) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            let dao_id = Self::next_dao_id();
            let next_id = dao_id.saturating_add(1);
            NextDaoId::<T>::put(next_id);

            Self::deposit_event(Event::DaoCreated { dao_id, creator });
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn create_proposal(
            origin: OriginFor<T>,
            dao_id: u32,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            let proposal_id = Self::next_proposal_id();
            let next_id = proposal_id.saturating_add(1);
            NextProposalId::<T>::put(next_id);

            Self::deposit_event(Event::ProposalCreated {
                dao_id,
                proposal_id,
                creator,
            });
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn vote(
            origin: OriginFor<T>,
            dao_id: u32,
            proposal_id: u32,
            choice: u8,
        ) -> DispatchResult {
            let voter = ensure_signed(origin)?;
            Self::deposit_event(Event::Voted {
                dao_id,
                proposal_id,
                voter,
                choice,
            });
            Ok(())
        }
    }

    #[pallet::genesis_config]
    pub struct GenesisConfig<T: Config> {
        pub _phantom: PhantomData<T>,
    }

    #[cfg(feature = "std")]
    impl<T: Config> Default for GenesisConfig<T> {
        fn default() -> Self {
            Self {
                _phantom: Default::default(),
            }
        }
    }

    #[pallet::genesis_build]
    impl<T: Config> GenesisBuild<T> for GenesisConfig<T> {
        fn build(&self) {
            NextDaoId::<T>::put(0);
            NextProposalId::<T>::put(0);
        }
    }
}
