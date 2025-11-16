use polokol_runtime::{self as runtime, Runtime};
use sc_service::{Configuration, TaskManager};
use sp_runtime::traits::Block as BlockT;
use std::sync::Arc;

pub type Block = runtime::Block;
pub type Client = sc_service::TFullClient<
    Block,
    Runtime,
    sc_client_api::LocalCallExecutor<Block, sc_service::TFullBackend<Block>, sc_executor::WasmExecutor<sp_io::SubstrateHostFunctions>>,
    runtime::RuntimeApi,
    sc_executor::WasmExecutor<sp_io::SubstrateHostFunctions>,
>;

pub fn new_full_parts(
    config: &Configuration,
) -> Result<
    (
        Arc<Client>,
        Arc<sc_service::TFullBackend<Block>>,
        sc_consensus::DefaultImportQueue<Block, Client>,
        TaskManager,
    ),
    sc_service::Error,
> {
    let executor = sc_executor::WasmExecutor::<sp_io::SubstrateHostFunctions>::new(
        sc_executor::WasmExecutionMethod::Compiled {
            fast_instance_reuse: true,
        },
        Some(1024),
        2,
        None,
        None,
    );

    let (client, backend, keystore_container, task_manager) =
        sc_service::new_full_parts::<Block, Runtime, _>(
            config,
            None,
            executor.clone(),
        )?;

    let import_queue = sc_consensus_aura::import_queue::<_, _, _, AuraPair, _, _>(
        sp_consensus_aura::slot_duration(),
        client.clone(),
        client.clone(),
        keystore_container.keystore(),
        &task_manager.spawn_essential_handle(),
        config.prometheus_registry(),
        sp_consensus::CanAuthorWithNativeVersion::new(client.executor().clone()),
    )?;

    Ok((client, backend, import_queue, task_manager))
}

pub fn new_full(config: Configuration) -> Result<TaskManager, sc_service::Error> {
    let executor = sc_executor::WasmExecutor::<sp_io::SubstrateHostFunctions>::new(
        sc_executor::WasmExecutionMethod::Compiled {
            fast_instance_reuse: true,
        },
        Some(1024),
        2,
        None,
        None,
    );

    let (client, backend, keystore_container, mut task_manager, on_demand) =
        sc_service::new_full_parts::<Block, Runtime, _>(
            &config,
            None,
            executor.clone(),
        )?;

    let select_chain = sc_consensus::LongestChain::new(backend.clone());

    let (grandpa_block_import, grandpa_link) = sc_finality_grandpa::block_import(
        client.clone(),
        &(client.clone() as Arc<_>),
        select_chain.clone(),
    )?;

    let (block_import, mut link_half) = sc_consensus_aura::import_queue::<_, _, _, AuraPair, _, _>(
        sp_consensus_aura::slot_duration(),
        grandpa_block_import,
        None,
        Some(Box::new(grandpa_link.clone())),
        client.clone(),
        None,
        &task_manager.spawn_essential_handle(),
        config.prometheus_registry(),
        sp_consensus::CanAuthorWithNativeVersion::new(client.executor().clone()),
    )?;

    let inherent_data_providers = sp_inherents::InherentDataProviders::new();
    inherent_data_providers
        .register_provider(pallet_timestamp::InherentDataProvider)
        .map_err(|e| sc_service::Error::Other(format!("Failed to register timestamp provider: {:?}", e)))?;

    let (network, network_status_sinks, system_rpc_tx, network_starter) =
        sc_service::build_network(sc_service::BuildNetworkParams {
            config: &config,
            client: client.clone(),
            transaction_pool: transaction_pool.clone(),
            spawn_handle: task_manager.spawn_handle(),
            import_queue,
            on_demand: Some(on_demand.clone()),
            block_announce_validator_builder: None,
            warp_sync_params: None,
        })?;

    let rpc_extensions_builder = {
        let client = client.clone();
        let pool = transaction_pool.clone();

        Box::new(move |deny_unsafe, _| {
            let deps = substrate_frame_rpc_system::SystemDeps {
                client: client.clone(),
                pool: pool.clone(),
                deny_unsafe,
            };

            substrate_frame_rpc_system::create_full(deps)
        })
    };

    sc_service::spawn_tasks(sc_service::SpawnTasksParams {
        network: network.clone(),
        client: client.clone(),
        keystore: keystore_container.keystore(),
        task_manager: &mut task_manager,
        transaction_pool: transaction_pool.clone(),
        rpc_builder: rpc_extensions_builder,
        backend,
        network_status_sinks,
        system_rpc_tx,
        config,
    })?;

    network_starter.start_network();

    let grandpa_config = sc_finality_grandpa::GrandpaParams {
        genesis_hash: client.block_hash(0).ok().flatten().expect("Genesis block exists; qed"),
        config: grandpa::Config {
            gossip_duration: std::time::Duration::from_millis(333),
            justification_period: 512,
            name: Some(format!("polokol-grandpa-{}", config.network.node_key.public())),
            observer_enabled: true,
            keystore: Some(keystore_container.keystore()),
            is_authority: config.role.is_authority(),
        },
        link: grandpa_link,
        network: network.clone(),
        voting_rule: sc_finality_grandpa::VotingRule::default(),
        prometheus_registry: config.prometheus_registry(),
        shared_voter_state: sc_finality_grandpa::SharedVoterState::empty(),
        telemetry: config.telemetry_endpoints.clone(),
    };

    task_manager.spawn_essential_handle().spawn_blocking(
        "grandpa-voter",
        None,
        sc_finality_grandpa::run_grandpa_voter(grandpa_config)?,
    );

    let babe_config = sc_consensus_babe::BabeParams {
        keystore: keystore_container.keystore(),
        client: client.clone(),
        select_chain,
        env: sc_profiler::ProvingBackend::<_, sp_core::Blake2Hasher>::new(
            backend.clone(),
        ),
        block_import,
        sync_oracle: sc_network_sync::SyncingService::new(
            client.clone(),
            backend.clone(),
            task_manager.spawn_handle(),
            config.network.clone(),
        ),
        inherent_data_providers: inherent_data_providers.clone(),
        force_authoring: config.force_authoring,
        backoff_authoring_blocks: None,
        babe_link: link_half,
        block_proposal_slot_portion: sp_consensus_babe::SlotProportion::new(2f32 / 3f32),
        max_block_proposal_slot_portion: None,
        telemetry: config.telemetry_endpoints.clone(),
    };

    let babe = sc_consensus_babe::start_babe(babe_config)?;

    task_manager.spawn_essential_handle().spawn_blocking(
        "babe",
        None,
        babe,
    );

    Ok(task_manager)
}

type AuraPair = sp_consensus_aura::sr25519::AuthorityPair;