import type { ModelProvider, ModelRequest, ModelResponse } from "../../core/src/types.js";

export class OllamaProvider implements ModelProvider {
  id="ollama"; local=true;
  constructor(private baseUrl=process.env.OLLAMA_URL || "http://127.0.0.1:11434", private defaultModel=process.env.OLLAMA_MODEL || "qwen2.5:7b"){}
  async health(){ try { const r=await fetch(`${this.baseUrl}/api/tags`,{signal:AbortSignal.timeout(2000)}); return r.ok; } catch { return false; } }
  async models(){ try { const r=await fetch(`${this.baseUrl}/api/tags`); const j=await r.json() as any; return (j.models||[]).map((m:any)=>m.name); } catch { return []; } }
  async generate(request:ModelRequest, model=this.defaultModel):Promise<ModelResponse>{ const started=Date.now(); const r=await fetch(`${this.baseUrl}/api/generate`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({model,prompt:request.prompt,system:request.system,stream:false,format:request.json?"json":undefined})}); if(!r.ok) throw new Error(`Ollama ${r.status}`); const j=await r.json() as any; return {text:j.response||"",provider:this.id,model,local:true,latencyMs:Date.now()-started}; }
}
export class OpenAICompatibleProvider implements ModelProvider {
  id="cloud"; local=false;
  constructor(private baseUrl=process.env.CLOUD_MODEL_URL||"", private apiKey=process.env.CLOUD_MODEL_API_KEY||"", private defaultModel=process.env.CLOUD_MODEL||"gpt-5.6"){}
  async health(){ return Boolean(this.baseUrl && this.apiKey); }
  async models(){ return this.defaultModel?[this.defaultModel]:[]; }
  async generate(request:ModelRequest, model=this.defaultModel):Promise<ModelResponse>{ const started=Date.now(); const r=await fetch(`${this.baseUrl.replace(/\/$/,"")}/chat/completions`,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${this.apiKey}`},body:JSON.stringify({model,messages:[...(request.system?[{role:"system",content:request.system}]:[]),{role:"user",content:request.prompt}]})}); if(!r.ok) throw new Error(`Cloud model ${r.status}`); const j=await r.json() as any; return {text:j.choices?.[0]?.message?.content||"",provider:this.id,model,local:false,latencyMs:Date.now()-started}; }
}
export class ModelRouter {
  constructor(public providers:ModelProvider[]){}
  async route(request:ModelRequest){ const preferLocal=(request.complexity??1)<=6; const ordered=[...this.providers].sort((a,b)=>Number(b.local===preferLocal)-Number(a.local===preferLocal)); let last:unknown; for(const p of ordered){ try { if(await p.health()) return await p.generate(request); } catch(e){ last=e; } } throw last instanceof Error?last:new Error("No healthy model provider"); }
  async status(){ return Promise.all(this.providers.map(async p=>({id:p.id,local:p.local,healthy:await p.health(),models:await p.models()}))); }
}
