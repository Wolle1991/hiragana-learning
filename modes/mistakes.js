export function mostMistakenItems(items,mistakesMap){return items.filter(i=>mistakesMap[i.char]).sort((a,b)=>(mistakesMap[b.char]||0)-(mistakesMap[a.char]||0))}
