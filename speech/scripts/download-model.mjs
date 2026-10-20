import {mkdir,rename,writeFile,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
const model=process.argv[2]??'base-q5_1';
if(!['base-q5_1','small-q5_1'].includes(model))throw new Error('Choose multilingual base-q5_1 or small-q5_1. English-only models are not supported.');
const directory=new URL('../models/',import.meta.url);await mkdir(directory,{recursive:true});
const name=`ggml-${model}.bin`;
const metadata=await fetch('https://huggingface.co/api/models/ggerganov/whisper.cpp?blobs=true').then(r=>{if(!r.ok)throw new Error('Model metadata request failed');return r.json();});
const file=metadata.siblings.find(f=>f.rfilename===name);if(!file?.lfs?.sha256)throw new Error('Missing upstream model SHA256');
const url=`https://huggingface.co/ggerganov/whisper.cpp/resolve/${metadata.sha}/${name}`;
const response=await fetch(url);if(!response.ok||!response.body)throw new Error('Model download failed');
const hash=createHash('sha256');const partial=new URL(name+'.partial',directory),target=new URL(name,directory);
try{
  await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,_encoding,done){hash.update(chunk);done(null,chunk);}}),createWriteStream(partial));
  const digest=hash.digest('hex');if(digest!==file.lfs.sha256)throw new Error('Model SHA256 mismatch');
  await rename(partial,target);await writeFile(new URL(`${model}.manifest.json`,directory),JSON.stringify({model,revision:metadata.sha,sha256:digest,url,downloadedAt:new Date().toISOString()},null,2));
  console.log(`Verified multilingual ${model} model: ${target.pathname}`);
}finally{await rm(partial,{force:true});}
