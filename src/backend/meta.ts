// generated table metadata
export type ColKind = "text"|"num"|"bool"|"json";
export type Rel = { fk: string; col: string; ref: string; refcol: string };
export const META: Record<string,{pk:string;cols:Record<string,ColKind>;rels:Rel[]}> = {
 "reviews": {"pk":"id","cols":{"id":"text","kind":"text","target":"text","user_id":"text","reviewer_name":"text","rating":"num","body":"text","ref_id":"text","hidden":"num","reply":"text","reply_at":"text","created_at":"text","updated_at":"text"},"rels":[]},
 "site_settings": {"pk":"key","cols":{"key":"text","value":"text","updated_at":"text","updated_by":"text"},"rels":[]},
 "artwork_colorways": {
  "pk": "id",
  "cols": {
   "artwork_path": "text",
   "current_original_id": "text",
   "id": "text",
   "name": "text",
   "position": "num",
   "print_file_url": "text",
   "source_name": "text",
   "swatch": "text",
   "upload_id": "text"
  },
  "rels": [
   {
    "fk": "artwork_colorways_current_original_id_fkey",
    "col": "current_original_id",
    "ref": "print_originals",
    "refcol": "id"
   },
   {
    "fk": "artwork_colorways_upload_id_fkey",
    "col": "upload_id",
    "ref": "artwork_uploads",
    "refcol": "id"
   }
  ]
 },
 "artwork_mockups": {
  "pk": "id",
  "cols": {
   "colorway_id": "text",
   "id": "text",
   "image_path": "text",
   "room": "num"
  },
  "rels": [
   {
    "fk": "artwork_mockups_colorway_id_fkey",
    "col": "colorway_id",
    "ref": "artwork_colorways",
    "refcol": "id"
   }
  ]
 },
 "artwork_uploads": {
  "pk": "id",
  "cols": {
   "categories": "json",
   "created_at": "text",
   "deleted_at": "text",
   "deleted_by": "text",
   "description": "text",
   "designer_notes": "text",
   "drive_folder": "text",
   "error": "text",
   "height_cm": "num",
   "id": "text",
   "kind": "text",
   "lease_until": "text",
   "made_for": "json",
   "max_print_height_cm": "num",
   "max_print_width_cm": "num",
   "owner_id": "text",
   "palette": "text",
   "print_file_url": "text",
   "repeat_style": "text",
   "review_note": "text",
   "review_status": "text",
   "sku": "text",
   "status": "text",
   "story": "text",
   "submitted_at": "text",
   "tags": "json",
   "title": "text",
   "width_cm": "num"
  },
  "rels": []
 },
 "conversations": {
  "pk": "id",
  "cols": {
   "created_at": "text",
   "custom_request_id": "text",
   "customer_id": "text",
   "design_slug": "text",
   "designer_slug": "text",
   "id": "text",
   "title": "text"
  },
  "rels": [
   {
    "fk": "conversations_custom_request_id_fkey",
    "col": "custom_request_id",
    "ref": "custom_requests",
    "refcol": "id"
   }
  ]
 },
 "custom_requests": {
  "pk": "id",
  "cols": {
   "brief": "text",
   "budget": "text",
   "created_at": "text",
   "customer_email": "text",
   "customer_name": "text",
   "design_slug": "text",
   "designer_slug": "text",
   "id": "text",
   "material": "text",
   "photo_paths": "json",
   "room": "text",
   "selection": "json",
   "status": "text",
   "user_id": "text",
   "wall_size": "text"
  },
  "rels": []
 },
 "design_listing": {
  "pk": "slug",
  "cols": {
   "hidden": "bool",
   "slug": "text",
   "updated_at": "text",
   "updated_by": "text"
  },
  "rels": []
 },
 "design_offers": {
  "pk": "id",
  "cols": {
   "accepted_at": "text",
   "amount": "num",
   "conversation_id": "text",
   "conversation_kind": "text",
   "created_at": "text",
   "created_by": "text",
   "delivered_at": "text",
   "delivery_days": "num",
   "description": "text",
   "designer_slug": "text",
   "id": "text",
   "proof_approved_at": "text",
   "proof_note": "text",
   "proof_path": "text",
   "proof_status": "text",
   "status": "text"
  },
  "rels": []
 },
 "design_overrides": {
  "pk": "slug",
  "cols": {
   "added_photos": "json",
   "description": "text",
   "image_path": "text",
   "price_per_sqft": "num",
   "removed_photos": "json",
   "slug": "text",
   "story": "text",
   "title": "text",
   "updated_at": "text",
   "updated_by": "text"
  },
  "rels": []
 },
 "designer_accounts": {
  "pk": "slug",
  "cols": {
   "slug": "text",
   "user_id": "text"
  },
  "rels": []
 },
 "designer_collections": {
  "pk": "id",
  "cols": {
   "created_at": "text",
   "description": "text",
   "design_slugs": "json",
   "designer_slug": "text",
   "id": "text",
   "owner_id": "text",
   "title": "text",
   "updated_at": "text"
  },
  "rels": []
 },
 "designer_messages": {
  "pk": "id",
  "cols": {
   "attachment_path": "text",
   "body": "text",
   "conversation_id": "text",
   "created_at": "text",
   "id": "text",
   "selection": "json",
   "sender_id": "text",
   "sender_role": "text"
  },
  "rels": [
   {
    "fk": "designer_messages_conversation_id_fkey",
    "col": "conversation_id",
    "ref": "conversations",
    "refcol": "id"
   }
  ]
 },
 "designer_payouts": {
  "pk": "id",
  "cols": {
   "method": "text",
   "status": "text",
   "amount": "num",
   "created_by": "text",
   "designer_user_id": "text",
   "id": "text",
   "note": "text",
   "paid_at": "text"
  },
  "rels": []
 },
 "designer_profiles": {
  "pk": "user_id",
  "cols": {
   "bio": "text",
   "country": "text",
   "created_at": "text",
   "full_name": "text",
   "payout_details": "text",
   "payout_method": "text",
   "portfolio_links": "json",
   "review_note": "text",
   "reviewed_at": "text",
   "status": "text",
   "studio_name": "text",
   "styles": "json",
   "trusted": "bool",
   "user_id": "text",
   "tagline": "text",
   "photo_key": "text",
   "specialties": "json",
   "portfolio": "json",
   "response_label": "text",
   "turnaround_days": "num",
   "public_hidden": "num"
  },
  "rels": []
 },
 "designer_reviews": {
  "pk": "id",
  "cols": {
   "body": "text",
   "created_at": "text",
   "designer_slug": "text",
   "id": "text",
   "rating": "num",
   "reviewer_name": "text",
   "user_id": "text"
  },
  "rels": []
 },
 "guest_conversation_messages": {
  "pk": "id",
  "cols": {
   "attachment_path": "text",
   "body": "text",
   "conversation_id": "text",
   "created_at": "text",
   "id": "text",
   "selection": "json",
   "sender": "text"
  },
  "rels": [
   {
    "fk": "guest_conversation_messages_conversation_id_fkey",
    "col": "conversation_id",
    "ref": "guest_conversations",
    "refcol": "id"
   }
  ]
 },
 "guest_conversations": {
  "pk": "id",
  "cols": {
   "created_at": "text",
   "customer_name": "text",
   "design_slug": "text",
   "designer_slug": "text",
   "id": "text",
   "title": "text",
   "token_hash": "text"
  },
  "rels": []
 },
 "guest_designer_requests": {
  "pk": "id",
  "cols": {
   "body": "text",
   "created_at": "text",
   "customer_email": "text",
   "customer_name": "text",
   "design_slug": "text",
   "designer_slug": "text",
   "id": "text",
   "selection": "json"
  },
  "rels": []
 },
 "material_settings": {
  "pk": "id",
  "cols": {
   "active": "bool",
   "blurb": "text",
   "factor": "num",
   "id": "text",
   "name": "text",
   "price_adj": "num",
   "sample_in": "num",
   "standard": "bool",
   "texture": "text",
   "updated_at": "text"
  },
  "rels": []
 },
 "order_requests": {
  "pk": "id",
  "cols": {
   "discount": "num",
   "coupon": "text",
   "tax": "num",
   "credit_applied": "num",
   "amount_due": "num",
   "carrier": "text",
   "cart_id": "text",
   "created_at": "text",
   "custom_offer_id": "text",
   "customer_email": "text",
   "customer_name": "text",
   "delivery_date": "text",
   "design_slug": "text",
   "estimated_total": "num",
   "finish": "text",
   "id": "text",
   "notes": "text",
   "payment_method": "text",
   "phone": "text",
   "print_design_snapshot": "json",
   "print_original_id": "text",
   "selection": "json",
   "shipping_address": "text",
   "source": "text",
   "square_feet": "num",
   "status": "text",
   "status_updated_at": "text",
   "tracking_number": "text",
   "user_id": "text"
  },
  "rels": [
   {
    "fk": "order_requests_print_original_id_fkey",
    "col": "print_original_id",
    "ref": "print_originals",
    "refcol": "id"
   }
  ]
 },
 "print_originals": {
  "pk": "id",
  "cols": {
   "byte_size": "num",
   "colorway_id": "text",
   "created_at": "text",
   "effective_dpi": "num",
   "filename": "text",
   "id": "text",
   "mime_type": "text",
   "owner_id": "text",
   "pixel_height": "num",
   "pixel_width": "num",
   "storage_path": "text",
   "validation_status": "text"
  },
  "rels": [
   {
    "fk": "print_originals_colorway_id_fkey",
    "col": "colorway_id",
    "ref": "artwork_colorways",
    "refcol": "id"
   }
  ]
 },
 "user_roles": {
  "pk": "id",
  "cols": {
   "id": "text",
   "role": "text",
   "user_id": "text"
  },
  "rels": []
 }
};
