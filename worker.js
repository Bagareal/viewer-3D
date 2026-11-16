importScripts('occt-import-js.js');
let occtP=null;
self.onmessage=async e=>{
  try{
    postMessage({status:'prep'});
    occtP??=occtimportjs({locateFile:f=>f});
    const o=await occtP;
    postMessage({status:'conv'});
    const p={linearUnit:'millimeter',linearDeflectionType:'bounding_box_ratio',linearDeflection:.0015,angularDeflection:.5};
    const data=new Uint8Array(e.data.buf);
    const r=e.data.iges?o.ReadIgesFile(data,p):o.ReadStepFile(data,p);
    if(!r.success)throw new Error('read failed');
    const meshes=[],tr=[];
    for(const m of r.meshes){const pos=new Float32Array(m.attributes.position.array);const idx=m.index?new Uint32Array(m.index.array):null;
      meshes.push({pos,idx,name:m.name||''});tr.push(pos.buffer);if(idx)tr.push(idx.buffer)}
    postMessage({meshes,root:r.root||null},tr);
  }catch(err){postMessage({error:String(err&&err.message||err)})}
};
