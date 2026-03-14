import {loadState,saveState} from './storage.js';export const state=loadState();export function persist(){saveState(state)}
