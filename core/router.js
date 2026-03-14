export let currentRoute={name:'home',params:{}};export function go(name,params={}){currentRoute={name,params};window.dispatchEvent(new CustomEvent('routechange'))}
