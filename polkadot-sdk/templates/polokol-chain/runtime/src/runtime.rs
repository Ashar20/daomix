#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{
    construct_runtime, parameter_types,
    traits::{ConstU32, ConstU64, ConstU128, ConstU8},
    PalletId,
};
use frame_system::{
    limits::{BlockLength, BlockWeights},
    EnsureRoot,
};
use pallet_transaction_payment::{ConstFeeMultiplier, Multiplier};
use sp_api::impl_runtime_apis;
use sp_core::{crypto::KeyTypeId, OpaqueMetadata};
use sp_runtime::{
    create_runtime_str, generic, impl_opaque_keys,
    traits::{AccountIdLookup, BlakeTwo256, Block as BlockT, IdentifyAccount, Verify},
    transaction_validity::{TransactionSource, TransactionValidity},
    ApplyExtrinsicResult, MultiSignature,
};
use sp_std::prelude::*;

#[cfg(feature = "std")]
use sp_version::NativeVersion;
use sp_version::RuntimeVersion;

// XCM imports
use staging_xcm as xcm;
use staging_xcm_builder as xcm_builder;
use staging_xcm_executor as xcm_executor;

pub use sp_runtime::{Perbill, Permill};

pub mod constants;
use constants::currency::*;

pub type BlockNumber = u32;
pub type Index = u32;
pub type Balance = u128;
pub type Hash = sp_core::H256;

pub const VERSION: RuntimeVersion = RuntimeVersion {
    spec_name: create_runtime_str!("polokol"),
    impl_name: create_runtime_str!("polokol"),
    authoring_version: 1,
    spec_version: 1,
    impl_version: 1,
    apis: sp_version::create_apis_vec!([]),
    transaction_version: 1,
    state_version: 1,
};

pub const MILLISECS_PER_BLOCK: u64 = 6000;
pub const SLOT_DURATION: u64 = MILLISECS_PER_BLOCK;

pub const EPOCH_DURATION_IN_BLOCKS: u32 = 10 * MINUTES;
pub const EPOCH_DURATION_IN_SLOTS: u64 = {
    const SLOT_DURATION_IN_MILLISECS: u64 = SLOT_DURATION;
    MILLISECS_PER_BLOCK / SLOT_DURATION_IN_MILLISECS * (EPOCH_DURATION_IN_BLOCKS as u64)
};

pub const MINUTES: BlockNumber = 60_000 / (MILLISECS_PER_BLOCK as BlockNumber);
pub const HOURS: BlockNumber = MINUTES * 60;
pub const DAYS: BlockNumber = HOURS * 24;

pub const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);

// XCM configuration
parameter_types! {
	pub const RelayLocation: xcm::latest::Location = xcm::latest::Location::parent();
	pub const RelayNetwork: Option<xcm::latest::NetworkId> = None;
	pub RelayChainOrigin: RuntimeOrigin = cumulus_pallet_xcm::Origin::Relay.into();
	pub UniversalLocation: xcm::latest::InteriorLocation = xcm::latest::Junctions::X1(xcm::latest::Junction::Parachain(ParachainInfo::parachain_id().into())).into();
}

/// Type for specifying how a `Location` can be converted into an `AccountId`.
pub type LocationToAccountId = (
	// The parent (Relay-chain) origin converts to the parent `AccountId`.
	xcm_builder::ParentIsPreset<AccountId>,
	// Sibling parachain origins convert to AccountId via the `ParaId::into`.
	xcm_builder::SiblingParachainConvertsVia<polkadot_parachain_primitives::primitives::Sibling, AccountId>,
	// Straight up local `AccountId32` origins just alias directly to `AccountId`.
	xcm_builder::AccountId32Aliases<RelayNetwork, AccountId>,
);

/// Means for transacting assets on this chain.
pub type LocalAssetTransactor = xcm_builder::FungibleAdapter<
	// Use this currency:
	Balances,
	// Use this currency when it is a fungible asset matching the given location or name:
	xcm_builder::IsConcrete<RelayLocation>,
	// Do a simple punn to convert an AccountId32 Location into a native chain account ID:
	LocationToAccountId,
	// Our chain's account ID type (we can't get away without mentioning it explicitly):
	AccountId,
	// We don't track any teleports.
	(),
>;

/// This is the type we use to convert an (incoming) XCM origin into a local `Origin` instance,
/// ready for dispatching a transaction with Xcm's `Transact`. There is an `OriginKind` which can
/// biases the kind of local `Origin` it will become.
pub type XcmOriginToTransactDispatchOrigin = (
	// Sovereign account converter; this attempts to derive an `AccountId` from the origin location
	// using `LocationToAccountId` and then turn that into the usual `Signed` origin. Useful for
	// foreign chains who want to have a local sovereign account on this chain which they control.
	xcm_builder::SovereignSignedViaLocation<LocationToAccountId, RuntimeOrigin>,
	// Native converter for Relay-chain (Parent) location; will convert to a `Relay` origin when
	// recognized.
	xcm_builder::RelayChainAsNative<RelayChainOrigin, RuntimeOrigin>,
	// Native converter for sibling Parachains; will convert to a `SiblingPara` origin when
	// recognized.
	xcm_builder::SiblingParachainAsNative<cumulus_pallet_xcm::Origin, RuntimeOrigin>,
	// Native signed account converter; this just converts an `AccountId32` origin into a normal
	// `RuntimeOrigin::Signed` origin of the same 32-byte value.
	xcm_builder::SignedAccountId32AsNative<RelayNetwork, RuntimeOrigin>,
	// Xcm origins can be represented natively under the Xcm pallet's Xcm origin.
	pallet_xcm::XcmPassthrough<RuntimeOrigin>,
);

parameter_types! {
	pub UnitWeightCost: xcm_executor::traits::Weight = xcm_executor::traits::Weight::from_parts(1_000_000_000, 64 * 1024);
	pub const MaxInstructions: u32 = 100;
	pub const MaxAssetsIntoHolding: u32 = 64;
}

/// Allow MixJob pallet calls from sibling parachains via XCM
pub struct AllowMixJobFromSiblings;
impl xcm_executor::traits::Contains<(xcm::latest::Location, xcm::latest::Xcm<RuntimeCall>)> for AllowMixJobFromSiblings {
	fn contains((origin, _xcm): &(xcm::latest::Location, xcm::latest::Xcm<RuntimeCall>)) -> bool {
		// Only allow from sibling parachains (not relay chain or local)
		let is_sibling_para = matches!(origin, xcm::latest::Location { parents: 1, interior: xcm::latest::Junctions::X1(_) });

		if !is_sibling_para {
			return false;
		}

		// For now, allow any XCM from sibling parachains (can be made more restrictive later)
		// In production, you would check for specific Transact instructions
		true
	}
}

pub struct ParentOrParentsExecutivePlurality;
impl xcm_executor::traits::Contains<xcm::latest::Location> for ParentOrParentsExecutivePlurality {
	fn contains(location: &xcm::latest::Location) -> bool {
		matches!(location.unpack(), (1, []) | (1, [xcm::latest::Junction::Plurality { id: xcm::latest::BodyId::Executive, .. }]))
	}
}

pub type Barrier = xcm_builder::TrailingSetTopicAsId<
	xcm_builder::DenyThenTry<
		xcm_builder::DenyReserveTransferToRelayChain,
		(
			xcm_builder::TakeWeightCredit,
			xcm_builder::WithComputedOrigin<
				(
					xcm_builder::AllowTopLevelPaidExecutionFrom<xcm_builder::Everything>,
					xcm_builder::AllowExplicitUnpaidExecutionFrom<ParentOrParentsExecutivePlurality>,
					// ^^^ Parent and its exec plurality get free execution
				),
				UniversalLocation,
				xcm_builder::ConstU32<8>,
			>,
		),
	>,
>;

pub struct XcmConfig;
impl xcm_executor::Config for XcmConfig {
	type RuntimeCall = RuntimeCall;
	type XcmSender = XcmRouter;
	type XcmEventEmitter = PolkadotXcm;
	// How to withdraw and deposit an asset.
	type AssetTransactor = LocalAssetTransactor;
	type OriginConverter = XcmOriginToTransactDispatchOrigin;
	type IsReserve = xcm_builder::NativeAsset;
	type IsTeleporter = (); // Teleporting is disabled.
	type UniversalLocation = UniversalLocation;
	type Barrier = Barrier;
	type Weigher = xcm_builder::FixedWeightBounds<UnitWeightCost, RuntimeCall, MaxInstructions>;
	type Trader =
		xcm_builder::UsingComponents<xcm_executor::traits::WeightToFee, RelayLocation, AccountId, Balances, ()>;
	type ResponseHandler = PolkadotXcm;
	type AssetTrap = PolkadotXcm;
	type AssetClaims = PolkadotXcm;
	type SubscriptionService = PolkadotXcm;
	type PalletInstancesInfo = AllPalletsWithSystem;
	type MaxAssetsIntoHolding = MaxAssetsIntoHolding;
	type AssetLocker = ();
	type AssetExchanger = ();
	type FeeManager = ();
	type MessageExporter = ();
	type UniversalAliases = xcm_builder::Nothing;
	type CallDispatcher = RuntimeCall;
	type SafeCallFilter = xcm_builder::Everything;
	type Aliasers = xcm_builder::Nothing;
	type TransactionalProcessor = xcm_builder::FrameTransactionalProcessor;
	type HrmpNewChannelOpenRequestHandler = ();
	type HrmpChannelAcceptedHandler = ();
	type HrmpChannelClosingHandler = ();
	type XcmRecorder = PolkadotXcm;
}

/// Converts a local signed origin into an XCM location. Forms the basis for local origins
/// sending/executing XCMs.
pub type LocalOriginToLocation = xcm_builder::SignedToAccountId32<RuntimeOrigin, AccountId, RelayNetwork>;

/// The means for routing XCM messages which are not for local execution into the right message
/// queues.
pub type XcmRouter = xcm_builder::WithUniqueTopic<(
	// Two routers - use UMP to communicate with the relay chain:
	cumulus_primitives_utility::ParentAsUmp<cumulus_pallet_parachain_system::Pallet<Runtime>, PolkadotXcm, ()>,
	// ..and XCMP to communicate with the sibling chains.
	XcmpQueue,
)>;

/// Downward message passing queue for relay chain messages
pub type DmpQueue = xcm_builder::WithUniqueTopic<(
	cumulus_pallet_parachain_system::DmpQueueAsParent<ParachainSystem>,
)>;

parameter_types! {
    pub const BlockHashCount: BlockNumber = 2400;
    pub const Version: RuntimeVersion = VERSION;
    pub BlockWeights: BlockWeights = BlockWeights::with_sensible_defaults(
        NORMAL_DISPATCH_RATIO * sp_runtime::constants::MAXIMUM_BLOCK_WEIGHT,
        Perbill::from_percent(75),
    );
    pub BlockLength: BlockLength = BlockLength::max_with_normal_ratio(5 * 1024 * 1024, NORMAL_DISPATCH_RATIO);
    pub const SS58Prefix: u8 = 42;
}

impl frame_system::Config for Runtime {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = BlockWeights;
    type BlockLength = BlockLength;
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = Index;
    type Hash = Hash;
    type Hashing = BlakeTwo256;
    type AccountId = sp_runtime::AccountId32;
    type Lookup = AccountIdLookup<Self::AccountId, ()>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = Version;
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<Balance>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
}

impl pallet_balances::Config for Runtime {
    type MaxLocks = ConstU32<50>;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    type Balance = Balance;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ConstU128<500>;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ConstU32<0>;
    type RuntimeHoldReason = ();
}

impl pallet_timestamp::Config for Runtime {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = ConstU64<{ SLOT_DURATION / 2 }>;
    type WeightInfo = ();
}

impl pallet_transaction_payment::Config for Runtime {
    type OnChargeTransaction = ();
    type OperationalFeeMultiplier = ConstU8<5>;
    type WeightToFee = ();
    type LengthToFee = ();
    type FeeMultiplierUpdate = ();
    type RuntimeEvent = RuntimeEvent;
}

impl pallet_sudo::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = ();
}

impl pallet_dao_voting::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
}

impl pallet_mix_job::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxJobs = ConstU32<1000>;
}

impl pallet_mixnet_registry::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxUrlLength = ConstU32<256>;
}

impl pallet_aura::Config for Runtime {
	type AuthorityId = AuraId;
	type DisabledValidators = ();
	type MaxAuthorities = ConstU32<100_000>;
	type AllowMultipleBlocksPerSlot = ConstBool<false>;
	type SlotDuration = pallet_aura::MinimumPeriodTimesTwo<Self>;
}

impl cumulus_pallet_aura_ext::Config for Runtime {}

impl staging_parachain_info::Config for Runtime {}

impl cumulus_pallet_parachain_system::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type OnSystemEvent = ();
	type SelfParaId = ParachainInfo;
	type OutboundXcmpMessageSource = XcmpQueue;
	type DmpMessageHandler = DmpQueue;
	type ReservedDmpWeight = ();
	type XcmpMessageHandler = XcmpQueue;
	type ReservedXcmpWeight = ();
	type CheckAssociatedRelayNumber = cumulus_pallet_parachain_system::RelayNumberStrictlyIncreases;
}

impl cumulus_pallet_xcmp_queue::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type XcmExecutor = xcm_executor::XcmExecutor<XcmConfig>;
	type ChannelInfo = ParachainSystem;
	type VersionWrapper = PolkadotXcm;
	type ExecuteOverweightOrigin = EnsureRoot<AccountId>;
	type ControllerOrigin = EnsureRoot<AccountId>;
	type ControllerOriginConverter = XcmOriginToTransactDispatchOrigin;
	type WeightInfo = ();
	type PriceForSiblingDelivery = ();
}

impl pallet_xcm::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type SendXcmOrigin = xcm_builder::EnsureXcmOrigin<RuntimeOrigin, LocalOriginToLocation>;
	type XcmRouter = XcmRouter;
	type ExecuteXcmOrigin = xcm_builder::EnsureXcmOrigin<RuntimeOrigin, LocalOriginToLocation>;
	type XcmExecuteFilter = AllowMixJobFromSiblings;
	// ^ Allow MixJob pallet calls from sibling parachains for cross-chain mixing
	type XcmExecutor = xcm_executor::XcmExecutor<XcmConfig>;
	type XcmTeleportFilter = xcm_builder::Everything;
	type XcmReserveTransferFilter = xcm_builder::Nothing;
	type Weigher = xcm_builder::FixedWeightBounds<UnitWeightCost, RuntimeCall, MaxInstructions>;
	type UniversalLocation = UniversalLocation;
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;

	const VERSION_DISCOVERY_QUEUE_SIZE: u32 = 100;
	// ^ Override for AdvertisedXcmVersion default
	type AdvertisedXcmVersion = pallet_xcm::CurrentXcmVersion;
	type Currency = Balances;
	type CurrencyMatcher = ();
	type TrustedLockers = ();
	type SovereignAccountOf = LocationToAccountId;
	type MaxLockers = frame_support::traits::ConstU32<8>;
	type WeightInfo = pallet_xcm::TestWeightInfo;
	type AdminOrigin = frame_system::EnsureRoot<AccountId>;
	type MaxRemoteLockConsumers = frame_support::traits::ConstU32<0>;
	type RemoteLockConsumerIdentifier = ();
	// Aliasing is disabled: xcm_executor::Config::Aliasers is set to `Nothing`.
	type AuthorizedAliasConsideration = frame_support::traits::Disabled;
}

impl cumulus_pallet_xcm::Config for Runtime {
	type RuntimeEvent = RuntimeEvent;
	type XcmExecutor = xcm_executor::XcmExecutor<XcmConfig>;
}

construct_runtime!(
    pub enum Runtime
    {
        System: frame_system,
        Timestamp: pallet_timestamp,
        Aura: pallet_aura,
        Balances: pallet_balances,
        ParachainInfo: staging_parachain_info,
        ParachainSystem: cumulus_pallet_parachain_system,
        TransactionPayment: pallet_transaction_payment,
        Sudo: pallet_sudo,
        DaoVoting: pallet_dao_voting,
        MixJob: pallet_mix_job,
        MixnetRegistry: pallet_mixnet_registry,
        XcmpQueue: cumulus_pallet_xcmp_queue,
        PolkadotXcm: pallet_xcm,
        CumulusXcm: cumulus_pallet_xcm,
    }
);

pub struct Executive;

impl frame_executive::Executive<
    Runtime,
    Block,
    frame_system::ChainContext<Runtime>,
    Runtime,
    AllPalletsWithSystem,
> for Executive
{
}

#[cfg(feature = "runtime-benchmarks")]
#[macro_use]
extern crate frame_benchmarking;

#[cfg(feature = "runtime-benchmarks")]
mod benches {
    define_benchmarks!(
        [frame_system, SystemBench::<Runtime>]
        [pallet_balances, Balances]
        [pallet_timestamp, Timestamp]
        [pallet_sudo, Sudo]
    );
}

pub type Block = generic::Block<Header, UncheckedExtrinsic>;
pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
pub type UncheckedExtrinsic = generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, SignedExtra>;
pub type SignedPayload = generic::SignedPayload<RuntimeCall, SignedExtra>;
pub type CheckedExtrinsic = generic::CheckedExtrinsic<AccountId, RuntimeCall, SignedExtra>;

impl_opaque_keys! {
    pub struct SessionKeys {}
}

impl_runtime_apis! {
    impl sp_api::Core<Block> for Runtime {
        fn version() -> RuntimeVersion {
            VERSION
        }

        fn execute_block(block: Block) {
            Executive::execute_block(block);
        }

        fn initialize_block(header: &<Block as BlockT>::Header) -> sp_runtime::ExtrinsicInclusionMode {
            Executive::initialize_block(header)
        }
    }

    impl sp_api::Metadata<Block> for Runtime {
        fn metadata() -> OpaqueMetadata {
            OpaqueMetadata::new(Runtime::metadata().into())
        }
    }

    impl sp_block_builder::BlockBuilder<Block> for Runtime {
        fn apply_extrinsic(extrinsic: <Block as BlockT>::Extrinsic) -> ApplyExtrinsicResult {
            Executive::apply_extrinsic(extrinsic)
        }

        fn finalize_block() -> <Block as BlockT>::Header {
            Executive::finalize_block()
        }

        fn inherent_extrinsics(data: sp_inherents::InherentData) -> Vec<<Block as BlockT>::Extrinsic> {
            data.create_extrinsics()
        }

        fn check_inherents(
            block: Block,
            data: sp_inherents::InherentData,
        ) -> sp_inherents::CheckInherentsResult {
            data.check_extrinsics(&block)
        }
    }

    impl sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block> for Runtime {
        fn validate_transaction(
            source: TransactionSource,
            tx: <Block as BlockT>::Extrinsic,
            block_hash: <Block as BlockT>::Hash,
        ) -> TransactionValidity {
            Executive::validate_transaction(source, tx, block_hash)
        }
    }

    impl sp_offchain::OffchainWorkerApi<Block> for Runtime {
        fn offchain_worker(header: &<Block as BlockT>::Header) {
            Executive::offchain_worker(header)
        }
    }

    impl sp_consensus_aura::AuraApi<Block, AuraId> for Runtime {
        fn slot_duration() -> u64 {
            SLOT_DURATION
        }

        fn authorities() -> Vec<AuraId> {
            Vec::new()
        }
    }

    impl sp_session::SessionKeys<Block> for Runtime {
        fn generate_session_keys(seed: Option<Vec<u8>>) -> Vec<u8> {
            SessionKeys::generate(seed)
        }

        fn decode_session_keys(
            encoded: Vec<u8>,
        ) -> Option<Vec<(Vec<u8>, KeyTypeId)>> {
            SessionKeys::decode_into_raw_public_keys(&encoded)
        }
    }

    impl frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Index> for Runtime {
        fn account_nonce(account: AccountId) -> Index {
            System::account_nonce(account)
        }
    }

    impl pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance> for Runtime {
        fn query_info(
            uxt: <Block as BlockT>::Extrinsic,
            len: u32,
        ) -> pallet_transaction_payment_rpc_runtime_api::RuntimeDispatchInfo<Balance> {
            TransactionPayment::query_info(uxt, len)
        }

        fn query_fee_details(
            uxt: <Block as BlockT>::Extrinsic,
            len: u32,
        ) -> pallet_transaction_payment::FeeDetails<Balance> {
            TransactionPayment::query_fee_details(uxt, len)
        }
    }
}

pub type Signature = MultiSignature;
pub type AccountPublic = <Signature as Verify>::Signer;
pub type AccountId = <AccountPublic as IdentifyAccount>::AccountId;
pub type Address = sp_runtime::MultiAddress<AccountId, ()>;
pub type AuraId = sp_consensus_aura::sr25519::AuthorityId;

pub type SignedExtra = (
    frame_system::CheckNonZeroSender<Runtime>,
    frame_system::CheckSpecVersion<Runtime>,
    frame_system::CheckTxVersion<Runtime>,
    frame_system::CheckGenesis<Runtime>,
    frame_system::CheckEra<Runtime>,
    frame_system::CheckNonce<Runtime>,
    frame_system::CheckWeight<Runtime>,
    pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
);

pub type AllPalletsWithSystem = (
    frame_system::Pallet<Runtime>,
    pallet_timestamp::Pallet<Runtime>,
    pallet_aura::Pallet<Runtime>,
    pallet_balances::Pallet<Runtime>,
    staging_parachain_info::Pallet<Runtime>,
    cumulus_pallet_parachain_system::Pallet<Runtime>,
    pallet_transaction_payment::Pallet<Runtime>,
    pallet_sudo::Pallet<Runtime>,
    pallet_dao_voting::Pallet<Runtime>,
    pallet_mix_job::Pallet<Runtime>,
    pallet_mixnet_registry::Pallet<Runtime>,
    cumulus_pallet_xcmp_queue::Pallet<Runtime>,
    pallet_xcm::Pallet<Runtime>,
    cumulus_pallet_xcm::Pallet<Runtime>,
);

#[cfg(feature = "std")]
use frame_support::traits::GenesisBuild;

#[cfg(feature = "std")]
#[derive(Default)]
pub struct GenesisConfig {
    pub system: frame_system::GenesisConfig,
    pub timestamp: pallet_timestamp::GenesisConfig,
    pub balances: pallet_balances::GenesisConfig,
    pub sudo: pallet_sudo::GenesisConfig,
    pub transaction_payment: pallet_transaction_payment::GenesisConfig,
    pub dao_voting: pallet_dao_voting::GenesisConfig<Runtime>,
    pub mixnet_registry: pallet_mixnet_registry::GenesisConfig<Runtime>,
}

#[cfg(feature = "std")]
impl sp_api::ConstructRuntimeApi<Block, sp_api::Client<Block>> for Runtime {
    fn construct_runtime_api(
        _client: &sp_api::Client<Block>,
    ) -> sp_api::Result<sp_api::ApiRef<Block>> {
        Ok(sp_api::ApiRef::new(RuntimeApiImpl {}))
    }
}

#[cfg(feature = "std")]
pub struct RuntimeApiImpl;

#[cfg(feature = "std")]
impl sp_api::Impl<Block> for RuntimeApiImpl {}

#[cfg(feature = "std")]
pub mod genesis;

#[cfg(feature = "std")]
pub mod wasm_binary {
    use super::*;
    substrate_wasm_builder::WasmBuilder::new()
        .with_current_project()
        .import_memory()
        .build();
}

#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));
