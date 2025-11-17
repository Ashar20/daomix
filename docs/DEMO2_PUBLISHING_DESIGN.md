# Demo 2: Censorship-Resistant Private Publishing

## Overview
A journalist can publish encrypted content on-chain while maintaining complete anonymity. The content is stored off-chain on IPFS, with encrypted metadata and references stored on-chain. The publisher's identity is hidden through mixing.

## Architecture

### Components
1. **PublishingChain (Para 3000)** - New parachain for encrypted publishing
2. **IPFS Integration** - Off-chain content storage (HTTP API `/api/v0/add`, `/api/v0/version`, per [Polkadot Storage Integrations → IPFS](https://docs.polkadot.com/develop/toolkit/integrations/storage/#ipfs))
3. **Onion Encryption** - Same approach as voting demo
4. **Mixing** - Hide publisher identity
5. **Public Browsing Dashboard** - Wall/archive view of all publications

### Flow
1. Journalist writes content
2. Content encrypted using onion encryption (mix nodes + public key)
3. Encrypted content uploaded to IPFS → get CID
4. Encrypted metadata (title, description, timestamp) + IPFS CID submitted on-chain via mixing
5. Publication appears in public dashboard (encrypted, so visible but unreadable)
6. Anyone with decryption key can decrypt and read

### Storage Structure
- **Publications**: Map PublicationId → Publication
- **Publication**: 
  - `ipfs_cid`: BoundedVec<u8, 256> (IPFS Content ID)
  - `encrypted_metadata`: BoundedVec<u8, 65536> (encrypted title, description, etc.)
  - `encrypted_content_ref`: BoundedVec<u8, 65536> (encrypted IPFS content reference)
  - `block_number`: BlockNumber (when published)
  - `publication_index`: u32 (sequential index)

### Key Features
- ✅ Off-chain content storage (IPFS)
- ✅ On-chain encrypted metadata
- ✅ Publisher identity hidden (mixing)
- ✅ Public browsing (encrypted content visible but unreadable)
- ✅ Same onion encryption as voting
- ✅ No key exchange needed (public can see encrypted content exists)

## Implementation Plan

1. Create `daomix-publishing` pallet
2. Create PublishingChain spec (Para 3000)
3. Create publishing demo UI
4. Integrate IPFS (local node or simulation)
5. Integrate mixing for publisher anonymity
6. Add to demo-start.sh

