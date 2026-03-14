export const rows=['a','ka','sa','ta','na','ha','ma','ya','ra','wa'];export function filterByRow(items,row){if(row==='all')return items;return items.filter(i=>i.group===row)}
