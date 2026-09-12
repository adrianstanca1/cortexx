import { createServer } from "node:http";
import { AgentRegistry, ApprovalService, EventBus, MemoryStore, ModelRouter, OllamaProvider, OpenAICompatibleProvider, Orchestrator, ToolRegistry } from "../../../packages/runtime/src/index.js";
import { promises as fs } from "node:fs";
import path from "node:path";

const events=new EventBus(); const agents=new AgentRegistry(); const approvals=new ApprovalService(events); const memory=new MemoryStore(events); const models=new ModelRouter([new OllamaProvider(),new OpenAICompatibleProvider()]); const orchestrator=new Orchestrator(agents,events,memory,models); const tools=new ToolRegistry(approvals,events);
const PORT=Number(process.env.PORT||4310); const webRoot=path.resolve(process.cwd(),"apps/web");
function json(res:any,status:number,data:unknown){res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*"});res.end(JSON.stringify(data));}
async function body(req:any){let s="";for await(const c of req)s+=c;return s?JSON.parse(s):{};}

const server=createServer(async(req:any,res:any)=>{try{
  const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`); if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"});return res.end();}
  if(url.pathname==="/health") return json(res,200,{ok:true,service:"cortex-agent-os",time:new Date().toISOString(),missions:orchestrator.missions.size});
  if(url.pathname==="/api/status") return json(res,200,{agents:agents.list().length,missions:orchestrator.listMissions().length,pendingApprovals:approvals.list("pending").length,models:await models.status()});
  if(url.pathname==="/api/agents") return json(res,200,agents.list());
  if(url.pathname==="/api/models") return json(res,200,await models.status());
  if(url.pathname==="/api/tools") return json(res,200,tools.list());
  if(url.pathname==="/api/memory") return json(res,200,url.searchParams.get("q")?memory.search(url.searchParams.get("q")!):memory.list());
  if(url.pathname==="/api/events") return json(res,200,events.list());
  if(url.pathname==="/api/events/stream"){res.writeHead(200,{"content-type":"text/event-stream","cache-control":"no-cache","connection":"keep-alive","access-control-allow-origin":"*"});const unsub=events.subscribe(e=>res.write(`data: ${JSON.stringify(e)}\n\n`));req.on("close",unsub);return;}
  if(url.pathname==="/api/approvals"&&req.method==="GET") return json(res,200,approvals.list());
  if(url.pathname.startsWith("/api/approvals/")&&req.method==="POST"){const id=url.pathname.split("/")[3];const b=await body(req);const item=approvals.decide(id,b.status);return item?json(res,200,item):json(res,404,{error:"Not found"});}
  if(url.pathname==="/api/missions"&&req.method==="GET") return json(res,200,orchestrator.listMissions());
  if(url.pathname==="/api/missions"&&req.method==="POST"){const b=await body(req);if(!b.goal)return json(res,400,{error:"goal required"});const mission=orchestrator.createMission(String(b.goal));if(b.run!==false)void orchestrator.runMission(mission.id);return json(res,201,mission);}
  if(url.pathname.startsWith("/api/missions/")&&req.method==="GET"){const id=url.pathname.split("/")[3];const m=orchestrator.mission(id);return m?json(res,200,m):json(res,404,{error:"Not found"});}
  if(url.pathname.startsWith("/api/missions/")&&url.pathname.endsWith("/run")&&req.method==="POST"){const id=url.pathname.split("/")[3];try{return json(res,200,await orchestrator.runMission(id));}catch(e){return json(res,404,{error:e instanceof Error?e.message:String(e)});}}
  if(url.pathname==="/"||url.pathname==="/index.html"){try{const html=await fs.readFile(path.join(webRoot,"index.html"),"utf8");res.writeHead(200,{"content-type":"text/html"});return res.end(html);}catch{return json(res,200,{name:"Cortex Agent OS",api:"/api/status"});}}
  return json(res,404,{error:"Not found"});
}catch(e){return json(res,500,{error:e instanceof Error?e.message:String(e)});}});
server.listen(PORT,()=>console.log(`Cortex Agent OS listening on :${PORT}`));
