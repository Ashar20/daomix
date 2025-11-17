// Entry file for bundling Polkadot.js API for browser use
import * as polkadotApi from '@polkadot/api';
import * as polkadotUtil from '@polkadot/util';
import * as polkadotUtilCrypto from '@polkadot/util-crypto';
import * as polkadotKeyring from '@polkadot/keyring';

// Expose to window for browser access
window.polkadotApi = polkadotApi;
window.polkadotUtil = polkadotUtil;
window.polkadotUtilCrypto = polkadotUtilCrypto;
window.polkadotKeyring = polkadotKeyring;

console.log('✅ Polkadot.js API bundle loaded (v16.4.7 with Extrinsic v5 support)');

