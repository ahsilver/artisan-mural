import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { quoteDetails } from './project-rules';
import { containsContactDetails, CONTACT_BLOCKED_MESSAGE } from './contact-guard';
async function identity(context: {supabase:any;userId:string}) {
 const [{data:admin},{data:profile},{data:account}]=await Promise.all([context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}),context.supabase.from('designer_profiles').select('status').eq('user_id',context.userId).maybeSingle(),context.supabase.from('designer_accounts').select('slug').eq('user_id',context.userId).maybeSingle()]);
 return {admin:admin===true,slug:profile?.status==='approved'?account?.slug??null:null};
}
export const listCustomProjects=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const who=await identity(context);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 let query=(who.admin||who.slug?supabaseAdmin:context.supabase).from('custom_requests').select('id,user_id,customer_name,room,wall_size,budget,brief,material,designer_slug,photo_paths,status,created_at,design_slug,selection').order('created_at',{ascending:false}).limit(100);
 if(!who.admin&&!who.slug)query=query.eq('user_id',context.userId);
 if(!who.admin&&who.slug)query=query.or(`designer_slug.eq.open,designer_slug.eq.${who.slug},user_id.eq.${context.userId}`);
 const {data:rows,error}=await query;if(error)throw new Error('Could not load requests.');
 const {data:conversations}=await context.supabase.from('conversations').select('id,custom_request_id,designer_slug').in('custom_request_id',(rows??[]).map(r=>r.id));
 const ids=(conversations??[]).map(c=>c.id);
 const {data:offers}=ids.length?await supabaseAdmin.from('design_offers').select('*').eq('conversation_kind','account').in('conversation_id',ids):{data:[]};
 const {data:orders}=ids.length?await supabaseAdmin.from('order_requests').select('id,status,custom_offer_id,square_feet,design_slug').in('custom_offer_id',(offers??[]).map(o=>o.id)):{data:[]};
 return {canQuote:who.admin||!!who.slug,rows:await Promise.all((rows??[]).map(async r=>{
  const convs=(conversations??[]).filter(c=>c.custom_request_id===r.id);const own=convs.find(c=>c.designer_slug===who.slug)??convs[0];
  const paths=r.photo_paths;const {data:photos}=paths.length?await supabaseAdmin.storage.from('custom-request-photos').createSignedUrls(paths,900):{data:[]};
  return {...r,mine:r.user_id===context.userId,photos:(photos??[]).map(p=>p.signedUrl),conversation:own?.id??null,offers:(offers??[]).filter(o=>convs.some(c=>c.id===o.conversation_id)),orders:(orders??[]).filter(o=>(offers??[]).some(f=>f.id===o.custom_offer_id&&convs.some(c=>c.id===f.conversation_id)))};
 }))};
});
export const quoteCustomRequest=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>quoteDetails.extend({request:z.string().uuid()}).parse(i)).handler(async({context,data})=>{
 const who=await identity(context);if(!who.admin&&!who.slug)throw new Error('Only approved designers can quote.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:request}=await supabaseAdmin.from('custom_requests').select('*').eq('id',data.request).single();
 if(!request||request.user_id===context.userId||request.status!=='new')throw new Error('This request is not available for a quote.');
 if(containsContactDetails(data.description))throw new Error(CONTACT_BLOCKED_MESSAGE);
 const slug=who.slug??(request.designer_slug!=='open'?request.designer_slug:null);if(!slug)throw new Error('Choose an assigned designer before quoting an open request.');
 if(request.designer_slug!=='open'&&request.designer_slug!==slug&&!who.admin)throw new Error('Request belongs to another designer.');
 let {data:conversation}=await supabaseAdmin.from('conversations').select('id').eq('custom_request_id',request.id).eq('designer_slug',slug).maybeSingle();
 if(!conversation){const result=await supabaseAdmin.from('conversations').insert({custom_request_id:request.id,customer_id:request.user_id,designer_slug:slug,title:`${request.room} · Custom project`,design_slug:request.design_slug}).select('id').single();conversation=result.data;if(!conversation)throw new Error('Could not open project conversation.');await supabaseAdmin.from('designer_messages').insert({conversation_id:conversation.id,sender_id:request.user_id,sender_role:'customer',body:request.brief,selection:request.selection});}
 const {error}=await supabaseAdmin.from('design_offers').insert({conversation_kind:'account',conversation_id:conversation.id,designer_slug:slug,created_by:context.userId,amount:Math.round(data.amount*100)/100,description:data.description,delivery_days:data.deliveryDays});
 if(error)throw new Error('Could not send quote.');return {conversation:conversation.id};
});
export const deliverProjectProof=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:FormData)=>{
 if(!(i instanceof FormData))throw new Error('Choose a proof picture.');const file=i.get('proof');
 if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024||!file.size)throw new Error('Choose a proof JPG/PNG/WebP up to 10 MB.');
 return {offer:z.string().uuid().parse(i.get('offer')),note:z.string().trim().max(1000).parse(i.get('note')??''),file};
}).handler(async({data,context})=>{
 if(containsContactDetails(data.note))throw new Error(CONTACT_BLOCKED_MESSAGE);const who=await identity(context);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:offer}=await supabaseAdmin.from('design_offers').select('*').eq('id',data.offer).single();
 if(!offer||(!who.admin&&who.slug!==offer.designer_slug)||offer.status!=='accepted'||offer.proof_status==='approved')throw new Error('Only the assigned designer can deliver accepted work.');
 const path=`proofs/${offer.id}/${crypto.randomUUID()}`;const stored=await supabaseAdmin.storage.from('message-photos').upload(path,data.file,{contentType:data.file.type});if(stored.error)throw new Error('Could not store proof.');
 const {error}=await supabaseAdmin.from('design_offers').update({proof_status:'delivered',proof_path:path,proof_note:data.note,delivered_at:new Date().toISOString()}).eq('id',offer.id).eq('status','accepted').neq('proof_status','approved');if(error)throw new Error('Could not deliver proof.');return {success:true};
});
export const getOrderProjects=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({order:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const who=await identity(context);if(!who.admin)throw new Error('Owner access required.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:order}=await supabaseAdmin.from('order_requests').select('user_id,custom_offer_id').eq('id',data.order).single();if(!order?.user_id)return {selected:null,offers:[]};
 const {data:conversations}=await supabaseAdmin.from('conversations').select('id').eq('customer_id',order.user_id);
 const ids=(conversations??[]).map(c=>c.id);
 const {data:offers}=ids.length?await supabaseAdmin.from('design_offers').select('id,amount,description').in('conversation_id',ids).eq('conversation_kind','account').eq('proof_status','approved').in('status',['accepted','paid']):{data:[]};
 return {selected:order.custom_offer_id,offers:offers??[]};
});
export const linkOrderProject=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({order:z.string().uuid(),offer:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const who=await identity(context);if(!who.admin)throw new Error('Owner access required.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:linked,error}=await supabaseAdmin.rpc('link_custom_project_order',{_order:data.order,_offer:data.offer});if(error||!linked)throw new Error('Choose an approved project belonging to this customer.');return {success:true};
});