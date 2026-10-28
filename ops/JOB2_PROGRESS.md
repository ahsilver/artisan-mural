# JOB2 progress (worker 9d0b63da)
DONE: lib/design-taxonomy.ts (defaultStyles/Themes, Taxonomy, parseTaxonomy, setTaxonomy/getTaxonomy, canonicalCategory/ies, canonicalRoom/s; effectiveCategories(rooms,styles,t)),
catalog.ts (Category=string, ShopData.taxonomy, registerShop->setTaxonomy, DesignOverride categories/room applied),
shop.server.ts (reads site_settings 'taxonomy', returns shop.taxonomy, overrides categories/rooms cols),
app-api.ts (DEFAULT_SETTINGS.taxonomy strings, PUBLIC_KEYS+taxonomy parsed, admin designs GET categories, override POST categories/rooms -> uploads or design_overrides cols),
designer-api.ts canonical save, designer/design-editor.tsx taxonomy chips Style/Theme/Rooms.
DONE ALSO (02:00Z): ALTER applied on D1 (+schema-2.sql), settings.tsx taxonomy group (rows 10), bo sections.tsx EditDesign Style/Theme/Rooms chips, browse.tsx multi-select (params kind,category,theme,room,color comma lists; .cat-chips All row), site-header All categories, styles.css backdrop+card lift. Build+deploy started 02:00Z (ops/bd.log). NEXT: ops/t42.py test + shots, WORKNOTES section, report.
OLD TODO: ALTER TABLE design_overrides ADD categories TEXT, rooms TEXT (D1); settings.tsx GROUPS taxonomy; bo sections.tsx admin design categories editor; browse.tsx multi-select + All chips; site-header All categories; styles.css backdrop + card lift; build; test; shots; WORKNOTES.
