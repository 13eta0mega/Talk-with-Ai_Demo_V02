/* Indexed triangle cages. SVG control points bind to one rest triangle and
 * are deformed by its barycentric coordinates; there is no bitmap texture.
 * Vertex bone weights are explicit, normalized and inspectable. */
(function(global){
 'use strict';
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 class TriangleMesh {
  constructor(id,points,{columns=8,rows=12,origin=[0,0],axis=[1,0],weights=()=>({root:1})}={}){
   this.id=id;this.columns=columns;this.rows=rows;this.origin=origin;this.axis=axis;this.normal=[-axis[1],axis[0]];
   const local=points.map(p=>this.toLocal(p));
   this.bounds=[Math.min(...local.map(p=>p[0]))-8,Math.min(...local.map(p=>p[1]))-8,Math.max(...local.map(p=>p[0]))+8,Math.max(...local.map(p=>p[1]))+8];
   this.rest=[];this.weights=[];this.triangles=[];
   for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    const p=this.toWorld([this.bounds[0]+(this.bounds[2]-this.bounds[0])*i/columns,this.bounds[1]+(this.bounds[3]-this.bounds[1])*j/rows]);
    this.rest.push(Object.freeze(p));const w=weights(p),sum=Object.values(w).reduce((a,b)=>a+b,0);
    if(!Number.isFinite(sum)||sum<=0||Object.values(w).some(x=>!Number.isFinite(x)||x<0))throw new Error('Invalid bone weights');
    this.weights.push(Object.freeze(Object.fromEntries(Object.entries(w).map(([k,v])=>[k,v/sum]))));
   }
   for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;this.triangles.push([a,b,d],[a,d,c]);}
   this.positions=this.rest.map(p=>[...p]);this.metrics={minimumAreaRatio:1,flippedTriangles:0,correctionScale:1,maximumEdgeRatio:1};
   this.edges=[...new Map(this.triangles.flatMap(t=>[[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]]).map(e=>{e.sort((a,b)=>a-b);return[e.join('-'),e]})).values()];
  }
  toLocal(p){const x=p[0]-this.origin[0],y=p[1]-this.origin[1];return[x*this.axis[0]+y*this.axis[1],x*this.normal[0]+y*this.normal[1]];}
  toWorld(p){return[this.origin[0]+p[0]*this.axis[0]+p[1]*this.normal[0],this.origin[1]+p[0]*this.axis[1]+p[1]*this.normal[1]];}
  bind(p){
   const q=this.toLocal(p),u=(q[0]-this.bounds[0])/(this.bounds[2]-this.bounds[0])*this.columns,v=(q[1]-this.bounds[1])/(this.bounds[3]-this.bounds[1])*this.rows;
   const x=clamp(Math.floor(u),0,this.columns-1),y=clamp(Math.floor(v),0,this.rows-1),fu=u-x,fv=v-y,index=(y*this.columns+x)*2+(fu>=fv?0:1);
   const triangle=this.triangles[index],weights=fu>=fv?[1-fu,fu-fv,fv]:[1-fv,fu,fv-fu];return{triangle:index,indices:triangle,weights};
  }
  sample(binding){return[0,1].map(k=>binding.indices.reduce((v,index,i)=>v+this.positions[index][k]*binding.weights[i],0));}
  deform(fn,anchorFrame=null){
   const proposed=this.rest.map((p,i)=>fn(p,this.weights[i],i));
   const baseline=anchorFrame?this.rest.map((p,i)=>anchorFrame(p,this.weights[i],i)):this.rest;
   if(proposed.some(p=>p.some(v=>!Number.isFinite(v))))throw new Error('Nonfinite mesh '+this.id);
   if(baseline.some(p=>p.some(v=>!Number.isFinite(v))))throw new Error('Nonfinite anchor frame '+this.id);
   const evaluate=alpha=>{
    const p=alpha===1?proposed:baseline.map((v,i)=>v.map((x,k)=>x+(proposed[i][k]-x)*alpha));let min=Infinity,maxEdge=0,flips=0;
    for(const t of this.triangles){const ratio=area(...t.map(i=>p[i]))/area(...t.map(i=>this.rest[i]));min=Math.min(min,ratio);if(ratio<=0)flips++;}
    for(const [a,b]of this.edges){const rest=Math.hypot(this.rest[a][0]-this.rest[b][0],this.rest[a][1]-this.rest[b][1]);maxEdge=Math.max(maxEdge,Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1])/rest);}
    return{positions:p,minimumAreaRatio:min,maximumEdgeRatio:maxEdge,flippedTriangles:flips};
   };
   let scale=1,result=evaluate(1);
   if(result.minimumAreaRatio<.3||result.maximumEdgeRatio>1.65){const safe=evaluate(0);if(safe.minimumAreaRatio<.3||safe.maximumEdgeRatio>1.65)throw new Error('Invalid anchor frame '+this.id);let low=0,high=1;for(let n=0;n<24;n++){const mid=(low+high)/2,r=evaluate(mid);if(r.minimumAreaRatio>=.3&&r.maximumEdgeRatio<=1.65)low=mid;else high=mid;}scale=low;result=evaluate(scale);}
   this.positions=result.positions;delete result.positions;this.metrics={...result,correctionScale:scale};
  }
  export(){return{id:this.id,vertices:this.rest,triangles:this.triangles,boneWeights:this.weights,grid:{columns:this.columns,rows:this.rows},metrics:this.metrics};}
 }
 global.TriangleMesh=TriangleMesh;
})(window);
