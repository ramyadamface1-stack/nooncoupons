#!/usr/bin/env node
// Exact existing renderer, run OFF the Cloudflare Worker in a GitHub CI job.
// Input JSON {path, manifest, segment}; output only the canonical XML bytes.
// Zero merchant requests; no writes to article data.
import {readFileSync} from 'node:fs';
import {rescueSitemapResponse} from '../r2-emergency-readonly.js';

const {path,manifest,segment}=JSON.parse(readFileSync(0,'utf8'));
const match=String(path||'').match(/^\/sitemap-rescue-(articles|images)-(\d{1,4})\.xml$/);
if(!match)throw Error('only_sa_ae_rescue_canary_shards_allowed');
if(!manifest||manifest.version!==1||!Array.isArray(manifest.segments)||
   !segment||segment.version!==1||!Array.isArray(segment.articles))throw Error('invalid_existing_quality_manifest');
const shard=manifest.segments.find(item=>item.n===Number(match[2]));
if(!shard?.key||shard.count!==segment.articles.length)throw Error('segment_not_in_published_manifest');
const env={CONTENT_FINAL:{get:async key=>{
  if(key==='seo-rescue/index.json')return {text:async()=>JSON.stringify(manifest),customMetadata:{}};
  if(key===shard.key)return {text:async()=>JSON.stringify(segment),customMetadata:{}};
  return null;
}}};
const response=await rescueSitemapResponse(path,env);
if(response?.status!==200)throw Error('existing_renderer_not_ok');
const xml=await response.text();
if(!xml.startsWith('<?xml version="1.0"')||
    (xml.match(/<url>/g)||[]).length!==segment.articles.length||
    (match[1]==='images'&&(xml.match(/<image:image>/g)||[]).length!==segment.articles.length))
  throw Error('rendered_xml_lost_urls');
process.stdout.write(xml);
