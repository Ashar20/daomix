# Demo 2: Publishing Demo - Implementation Status

## ✅ Completed

1. **Design Document** (`DEMO2_PUBLISHING_DESIGN.md`)
   - Architecture defined
   - Flow documented
   - Storage structure planned

2. **Publishing Demo UI** (`demo-ui-publishing.html`)
   - Publish tab (journalist interface)
   - Public Archive tab (browsing dashboard)
   - Setup tab (chain connection)
   - Real IPFS uploads via `/api/v0/add`
   - Configurable IPFS endpoint + health check

## 🚧 Next Steps (To Complete Full Implementation)

### 1. IPFS Hardening (DONE ✅)
- Default endpoint: `http://127.0.0.1:5001`
- UI now calls `/api/v0/version` (health) + `/api/v0/add?pin=true` (uploads)
- Instructions reference [Polkadot Storage Integrations → IPFS](https://docs.polkadot.com/develop/toolkit/integrations/storage/#ipfs)
- Reminder to enable CORS on local daemon:
  ```bash
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
  ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET","POST"]'
  ipfs daemon
  ```

### 2. Real Onion Encryption
- Reuse existing `mixer/src/onion.ts` functions
- Integrate with mix nodes for encryption
- Same approach as voting demo

### 3. PublishingChain Pallet
- Create `daomix-publishing` pallet (similar to `daomix-voting`)
- Storage for publications (IPFS CID + encrypted metadata)
- Functions: `publish`, `getPublications`, etc.

### 4. PublishingChain Setup
- Create PublishingChain spec (Para 3000)
- Add to `demo-start.sh`
- Configure transport mix proxy

### 5. Mixing Integration
- Hide publisher identity through transport mix
- Submit publications via 3-hop onion routing
- Same infrastructure as voting demo

### 6. Demo Server Integration
- Update `demo-ui-server.js` to serve publishing UI
- Add route: `/publishing` → `demo-ui-publishing.html`
- Or serve on different port

## Current Demo Features

✅ Basic UI with three tabs
✅ Simulated encryption (placeholder for onion path)
✅ Real IPFS uploads (returns actual CID)
✅ Public archive view
✅ Chain connection setup

## To Test Current Demo

1. Open `demo-ui-publishing.html` in browser
2. Go to Setup tab, connect to chain
3. Go to Publish tab, write article, publish
4. Go to Browse tab, see encrypted publications

## Full Implementation Plan

1. **Phase 1**: ✅ Real IPFS integration (local node or gateway)
2. **Phase 2**: Real onion encryption (reuse mixer code)
3. **Phase 3**: PublishingChain pallet (Rust)
4. **Phase 4**: Mixing integration (transport mix)
5. **Phase 5**: Full end-to-end testing

