#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    #[repr(u8)]
    #[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, Debug, TypeInfo, MaxEncodedLen)]
    pub enum Role {
        Ingress = 0,
        Middle = 1,
        Egress = 2,
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, Debug, TypeInfo, MaxEncodedLen)]
    pub struct MixNodeInfo<T: Config> {
        pub owner: T::AccountId,
        pub role: Role,
        pub url: BoundedVec<u8, T::MaxUrlLength>,
        pub active: bool,
    }

    #[pallet::pallet]
    #[pallet::generate_store(pub(super) trait Store)]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type MaxUrlLength: Get<u32>;
    }

    #[pallet::storage]
    #[pallet::getter(fn mix_nodes)]
    pub type MixNodes<T: Config> = StorageMap<_, Blake2_128Concat, u32, MixNodeInfo<T>>;

    #[pallet::storage]
    #[pallet::getter(fn next_node_id)]
    pub type NextNodeId<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        NodeRegistered {
            node_id: u32,
            owner: T::AccountId,
            role: Role,
        },
        NodeDeactivated {
            node_id: u32,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        NodeNotFound,
        UrlTooLong,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::weight(10_000)]
        pub fn register_node(
            origin: OriginFor<T>,
            role: Role,
            url: Vec<u8>,
        ) -> DispatchResult {
            let owner = ensure_signed(origin)?;

            ensure!(
                url.len() <= T::MaxUrlLength::get() as usize,
                Error::<T>::UrlTooLong
            );

            let node_id = Self::next_node_id();
            let next_id = node_id.saturating_add(1);
            NextNodeId::<T>::put(next_id);

            let bounded_url: BoundedVec<u8, T::MaxUrlLength> =
                url.try_into().map_err(|_| Error::<T>::UrlTooLong)?;

            let node_info = MixNodeInfo {
                owner,
                role,
                url: bounded_url,
                active: true,
            };

            MixNodes::<T>::insert(node_id, node_info);

            Self::deposit_event(Event::NodeRegistered {
                node_id,
                owner,
                role,
            });
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn deactivate_node(origin: OriginFor<T>, node_id: u32) -> DispatchResult {
            ensure_signed(origin)?;

            MixNodes::<T>::mutate(node_id, |node_info| {
                if let Some(info) = node_info {
                    info.active = false;
                    Self::deposit_event(Event::NodeDeactivated { node_id });
                    Ok(())
                } else {
                    Err(Error::<T>::NodeNotFound.into())
                }
            })
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
            NextNodeId::<T>::put(0);
        }
    }
}