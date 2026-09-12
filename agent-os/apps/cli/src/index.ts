const base=process.env.CORTEX_URL||"http://127.0.0.1:4310";
const [command,...args]=process.argv.slice(2);
async function request(path:string,init?:RequestInit){const r=await fetch(base+path,{headers:{"content-type":"application/json"},...init});const data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));return data;}
async function main(){switch(command){
  case "status": console.log(JSON.stringify(await request("/api/status"),null,2));break;
  case "agents": console.log(JSON.stringify(await request("/api/agents"),null,2));break;
  case "models": console.log(JSON.stringify(await request("/api/models"),null,2));break;
  case "approvals": console.log(JSON.stringify(await request("/api/approvals"),null,2));break;
  case "missions": console.log(JSON.stringify(await request("/api/missions"),null,2));break;
  case "mission": {const goal=args.join(" "); if(!goal)throw new Error("Usage: npm run cli -- mission <goal>");console.log(JSON.stringify(await request("/api/missions",{method:"POST",body:JSON.stringify({goal})}),null,2));break;}
  default: console.log("cortex commands: status | agents | models | approvals | missions | mission <goal>");
}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
