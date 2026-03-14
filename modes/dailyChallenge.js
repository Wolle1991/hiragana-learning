import {uidDate} from '../core/utils.js';export function getTodayKey(){return uidDate()}export function buildDailySet(items){return[...items].sort(()=>Math.random()-0.5).slice(0,20)}
