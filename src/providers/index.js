import tfl from './tfl.js';
import singapore from './singapore.js';
import nyc from './nyc.js';
import digitraffic from './digitraffic.js';
import caltrans from './caltrans.js';
import hongkong from './hongkong.js';
import ontario from './ontario.js';
import windy from './windy.js';
import { loadCustomProviders } from './custom.js';

export const builtinProviders = [tfl, singapore, nyc, digitraffic, caltrans, hongkong, ontario, windy];

export async function getProviders(config) {
  const all = [...builtinProviders, ...(await loadCustomProviders(config))];
  return all.filter((p) =>
    (!config.providers.length || config.providers.includes(p.id)) &&
    (p.enabled ? p.enabled(config) : true));
}
