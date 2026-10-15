-- =====================================================================
-- CoreUp — Reference DDL (PostgreSQL 16)
-- ใช้เป็น "แบบ" ให้ Drizzle schema ตรงกันทุกคอลัมน์/constraint
-- หลักความแน่น: FK ครบ, CHECK ทุก enum/ตัวเลข, unique ที่ธุรกิจต้องการ, RLS ทุกตาราง tenant
-- หลักความยืดหยุ่น: metadata/custom_fields jsonb, rule_sets มีเวอร์ชัน, templates มีเวอร์ชัน,
--                    external_refs สำหรับระบบภายนอก, *_events สำหรับประวัติ, text+check แทน pg enum
-- ลำดับไฟล์ migration จริงให้แยกตาม section ด้านล่าง
-- =====================================================================

-- ---------- 0. Extensions & helpers ----------
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists btree_gist;
create extension if not exists citext;

-- tenant ปัจจุบันจาก session (ตั้งโดย withTenantTx)
create or replace function app_tenant_id() returns uuid
language sql stable as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

-- updated_at อัตโนมัติ
create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- เพิ่ม version อัตโนมัติ (optimistic lock)
create or replace function bump_version() returns trigger
language plpgsql as $$ begin new.version := old.version + 1; return new; end $$;

-- ---------- 1. Platform core ----------
create table users (
  id uuid primary key,
  name text not null,
  email citext unique,
  email_verified_at timestamptz,
  email_verified boolean not null default false,        -- Better Auth (emailVerified)
  two_factor_enabled boolean not null default false,    -- Better Auth twoFactor plugin
  password_hash text,
  line_user_id text unique,
  avatar_url text,
  locale text not null default 'th' check (locale in ('th','en')),
  totp_secret_enc bytea,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or line_user_id is not null)
);

-- Better Auth (ไลบรารีกำหนดฟิลด์; id เป็น uuid, ไม่มี tenant_id / ไม่เปิด RLS — เข้าถึงผ่าน withPublicTx)
create table sessions (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text, user_agent text,
  active_tenant_id uuid,                               -- ร้านที่เลือกอยู่ (ไม่มี FK เพื่อไม่ผูกกับลำดับลบ)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sessions (user_id);
create table accounts (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  account_id text not null, provider_id text not null,
  access_token text, refresh_token text, id_token text,
  access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
  scope text, password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
);
create index on accounts (user_id);
create table verifications (
  id uuid primary key, identifier text not null, value text not null, expires_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on verifications (identifier);
create table two_factors (
  id uuid primary key, user_id uuid not null references users(id) on delete cascade,
  secret text not null, backup_codes text not null
);
create index on two_factors (user_id);

create table plans (
  id uuid primary key,
  code text not null unique,
  name text not null,
  price_minor bigint not null check (price_minor >= 0),
  interval text not null check (interval in ('month','year')),
  active boolean not null default true
);
create table plan_modules (plan_id uuid references plans(id) on delete cascade, module_key text not null, primary key (plan_id, module_key));
create table plan_limits  (plan_id uuid references plans(id) on delete cascade, key text not null, value int not null check (value >= 0), primary key (plan_id, key));

create table industry_templates (
  key text not null,
  version int not null,
  name jsonb not null,
  body jsonb not null,                 -- validate ด้วย Zod IndustryTemplate
  published_at timestamptz,
  primary key (key, version)
);

create table tenants (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null,
  legal_name text,
  industry_key text not null,
  template_version int not null,
  logo_url text,
  brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'Asia/Bangkok',
  currency char(3) not null default 'THB',
  locale text not null default 'th',
  country char(2) not null default 'TH',
  status text not null default 'trial' check (status in ('trial','active','paused','closed')),
  plan_id uuid references plans(id),
  ui_mode text not null default 'simple' check (ui_mode in ('simple','full')),
  settings jsonb not null default '{}',
  terminology jsonb not null default '{}',
  quiet_hours jsonb not null default '{"start":"21:00","end":"08:00"}',
  data_retention_days int not null default 730 check (data_retention_days between 30 and 3650),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (industry_key, template_version) references industry_templates(key, version)
);

create table tenant_modules (
  tenant_id uuid references tenants(id) on delete cascade,
  module_key text not null,
  source text not null check (source in ('plan','addon','trial','consultant')),
  enabled_until timestamptz,
  primary key (tenant_id, module_key)
);

create table branches (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  code text,
  address text, lat numeric(9,6), lng numeric(9,6), phone text,
  opening_hours jsonb not null default '{}',
  status text not null default 'active' check (status in ('active','closed')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id),                      -- ใช้ทำ composite FK กันข้าม tenant
  unique (tenant_id, code)
);

create table branch_resources (
  id uuid primary key,
  tenant_id uuid not null,
  branch_id uuid not null,
  name text not null,
  type text not null check (type in ('room','bed','chair','station','other')),
  capacity int not null default 1 check (capacity > 0),
  active boolean not null default true,
  sort int not null default 0, -- shop-defined order of rooms (migration 0023)
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id) references branches(tenant_id, id) on delete cascade
);

create table branch_closures (
  id uuid primary key, tenant_id uuid not null, branch_id uuid not null,
  date date not null, reason text,
  unique (branch_id, date),
  foreign key (tenant_id, branch_id) references branches(tenant_id, id) on delete cascade
);

create table positions (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  code text not null, name text not null, level int not null default 1,
  is_customer_facing boolean not null default false, sort int not null default 0,
  unique (tenant_id, id), unique (tenant_id, code)
);

create table roles (
  id uuid primary key,
  tenant_id uuid references tenants(id) on delete cascade,   -- null = system role
  key text not null, name text not null, is_system boolean not null default false,
  unique (tenant_id, key)
);
create table role_permissions (role_id uuid references roles(id) on delete cascade, permission text not null check (permission ~ '^[a-z_]+:[a-z_:]+$'), primary key (role_id, permission));

create table memberships (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references users(id),                  -- null ได้ ถ้ายังไม่รับคำเชิญ / ใช้ PIN อย่างเดียว
  display_name text not null,
  position_id uuid,
  employment_type text not null default 'full' check (employment_type in ('full','part','freelance','owner')),
  started_on date, ended_on date,
  status text not null default 'active' check (status in ('invited','active','inactive')),
  reports_to_membership_id uuid,
  pin_hash text,                                      -- สลับผู้ใช้บน iPad ร่วม
  phone_enc bytea,
  metadata jsonb not null default '{}',
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, user_id),
  foreign key (tenant_id, position_id) references positions(tenant_id, id),
  foreign key (tenant_id, reports_to_membership_id) references memberships(tenant_id, id),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);
create table membership_roles    (membership_id uuid references memberships(id) on delete cascade, role_id uuid references roles(id) on delete cascade, primary key (membership_id, role_id));
create table membership_branches (tenant_id uuid not null, membership_id uuid not null, branch_id uuid not null,
  primary key (membership_id, branch_id),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id) on delete cascade,
  foreign key (tenant_id, branch_id) references branches(tenant_id, id) on delete cascade);

create table invites (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  token_hash text not null unique, position_id uuid, role_ids uuid[] not null default '{}', branch_ids uuid[] not null default '{}',
  created_by uuid references memberships(id), expires_at timestamptz not null,
  accepted_by_user_id uuid references users(id), accepted_at timestamptz
);

create table field_definitions (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  entity text not null check (entity in ('customer','appointment','service','membership','service_record','bill')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$'),
  label jsonb not null,
  type text not null check (type in ('text','number','date','select','multiselect','boolean')),
  options jsonb, required boolean not null default false, sort int not null default 0, archived_at timestamptz,
  unique (tenant_id, entity, key)
);

create table org_profiles (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  size_band text, compensation_types text[] not null default '{}', owner_presence text, structure text,
  symptoms text[] not null default '{}', updated_at timestamptz not null default now()
);

-- ระบบภายนอก (POS, โปรแกรมคลินิก) — ยืดหยุ่นสำหรับ integration ในอนาคต
create table external_systems (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('pos','clinic','booking','accounting','other')),
  vendor text not null, config_enc bytea, status text not null default 'active',
  unique (tenant_id, id)
);
create table external_refs (
  tenant_id uuid not null, entity text not null, entity_id uuid not null,
  system_id uuid not null, external_id text not null,
  primary key (tenant_id, system_id, entity, external_id),
  foreign key (tenant_id, system_id) references external_systems(tenant_id, id) on delete cascade
);
create index on external_refs (tenant_id, entity, entity_id);

create table audit_logs (
  id bigserial primary key, tenant_id uuid, actor_user_id uuid, actor_membership_id uuid,
  actor_type text not null check (actor_type in ('member','platform','system','customer')),
  impersonating boolean not null default false,
  action text not null, entity text not null, entity_id uuid, diff jsonb, reason text, ip_hash text,
  created_at timestamptz not null default now()
);
create index on audit_logs (tenant_id, entity, entity_id, created_at desc);

create table outbox_events (
  id bigserial primary key, tenant_id uuid, type text not null, payload jsonb not null,
  created_at timestamptz not null default now(), processed_at timestamptz, attempts int not null default 0, last_error text
);
create index outbox_pending on outbox_events (id) where processed_at is null;

create table idempotency_keys (
  tenant_id uuid not null, key text not null, request_hash text not null, status_code int, response jsonb,
  created_at timestamptz not null default now(), primary key (tenant_id, key)
);

create table files (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  purpose text not null, storage_key text not null unique, mime text not null, size bigint not null check (size > 0),
  uploaded_by uuid, created_at timestamptz not null default now()
);

-- ---------- 2. CRM ----------
create table customers (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  code text,
  display_name text not null,
  phone_enc bytea, phone_hash text,
  email_enc bytea,
  birth_date date, gender text,
  line_user_id text, line_channel_account_id uuid,
  tags text[] not null default '{}',
  stage text not null default 'active' check (stage in ('lead','booked','active','due','lapsed')),
  preferred_branch_id uuid, preferred_membership_id uuid,
  owner_membership_id uuid,                       -- ผู้ดูแลหลัก
  secondary_membership_id uuid,                   -- ผู้ดูแลสำรอง (ลดความเสี่ยงลูกค้าผูกคนเดียว)
  source text not null default 'walk_in',
  consent_messaging boolean not null default false, consent_at timestamptz, consent_source text,
  has_caution boolean not null default false,     -- มีข้อควรระวัง (รายละเอียดอยู่ในระบบคลินิกเดิม)
  custom_fields jsonb not null default '{}',
  metadata jsonb not null default '{}',
  last_visit_at timestamptz, next_due_at timestamptz, visit_count int not null default 0 check (visit_count >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, erased_at timestamptz,
  -- migration 0021: set = no automatic follow-ups for this customer (reversible)
  followups_stopped_at timestamptz, followups_stopped_by uuid,
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, owner_membership_id) references memberships(tenant_id, id),
  foreign key (tenant_id, secondary_membership_id) references memberships(tenant_id, id),
  foreign key (tenant_id, preferred_branch_id) references branches(tenant_id, id)
);
create index on customers (tenant_id, phone_hash);
create unique index customers_line_uq on customers (tenant_id, line_user_id) where line_user_id is not null and deleted_at is null;
create index on customers (tenant_id, next_due_at) where deleted_at is null;
create index on customers (tenant_id, owner_membership_id);
create index on customers using gin (tags);
create index customers_name_trgm on customers using gin (display_name gin_trgm_ops);

create table customer_notes (                      -- "ข้อควรรู้" ความชอบ (ไม่ใช่ข้อมูลการรักษา)
  id uuid primary key, tenant_id uuid not null, customer_id uuid not null,
  body text not null check (length(body) <= 500), pinned boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id) on delete cascade
);

create table service_categories (id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade, name text not null, sort int not null default 0, unique (tenant_id, id));

create table services (
  id uuid primary key, tenant_id uuid not null, category_id uuid,
  name text not null, description text,
  duration_min int not null check (duration_min between 5 and 720),
  buffer_min int not null default 0 check (buffer_min between 0 and 240),
  price_minor bigint not null default 0 check (price_minor >= 0),
  rebook_after_days int check (rebook_after_days between 1 and 730),
  followup_plan jsonb not null default '[]',
  resource_type text, required_skill boolean not null default false,
  sop_id uuid,
  active boolean not null default true, sort int not null default 0,
  custom_fields jsonb not null default '{}',
  -- migration 0021: card colour, bookable from LINE, follow-up mode (default = shop plan | custom = followup_plan | none)
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  online_bookable boolean not null default true,
  followup_mode text not null default 'default' check (followup_mode in ('default','custom','none')),
  -- migration 0024: default lab cost (ค่าแลป) of one session, satang
  lab_cost_minor bigint not null default 0 check (lab_cost_minor >= 0),
  unique (tenant_id, id),
  foreign key (tenant_id, category_id) references service_categories(tenant_id, id)
);

-- ตารางทักษะ: ใครทำบริการไหนได้ ระดับไหน (ใช้ทั้งจองคิวและวัดความเสี่ยงงานคนเดียว)
create table member_skills (
  tenant_id uuid not null, membership_id uuid not null, service_id uuid not null,
  level text not null default 'can_do' check (level in ('learning','can_do','can_teach')),
  certified_at date,
  primary key (membership_id, service_id),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id) on delete cascade,
  foreign key (tenant_id, service_id) references services(tenant_id, id) on delete cascade
);

create table package_products (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null, service_ids uuid[] not null, sessions int not null check (sessions > 0),
  valid_days int not null check (valid_days > 0), price_minor bigint not null check (price_minor >= 0), active boolean not null default true,
  unique (tenant_id, id)
);
create table customer_packages (
  id uuid primary key, tenant_id uuid not null, customer_id uuid not null, package_product_id uuid not null,
  sessions_total int not null check (sessions_total > 0),
  sessions_used int not null default 0,
  purchased_at timestamptz not null, expires_at timestamptz not null,
  sold_by_membership_id uuid, branch_id uuid,
  unique (tenant_id, id),
  check (sessions_used between 0 and sessions_total),
  check (expires_at > purchased_at),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id),
  foreign key (tenant_id, package_product_id) references package_products(tenant_id, id)
);
-- migration 0016: ประวัติการใช้คอร์ส 1 แถวต่อ 1 ครั้ง (sessions_used ยังเป็นตัวนับ); void/refund ที่คืนครั้งให้ใส่ reversed_at
create table customer_package_uses (
  id uuid primary key, tenant_id uuid not null, customer_package_id uuid not null, customer_id uuid not null,
  branch_id uuid, service_id uuid, performer_membership_id uuid,
  used_at timestamptz not null,
  source text not null check (source in ('manual','appointment','bill','backfill')),
  appointment_id uuid, bill_id uuid, service_record_id uuid,
  note text, created_by uuid, created_at timestamptz not null default now(),
  reversed_at timestamptz, reversed_reason text,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_package_id) references customer_packages(tenant_id, id) on delete cascade,
  foreign key (tenant_id, customer_id) references customers(tenant_id, id),
  foreign key (tenant_id, service_id) references services(tenant_id, id),
  foreign key (tenant_id, performer_membership_id) references memberships(tenant_id, id)
);
create index customer_package_uses_package_idx on customer_package_uses (customer_package_id, used_at desc);
create index customer_package_uses_customer_idx on customer_package_uses (tenant_id, customer_id, used_at desc);

-- migration 0019: ข้อมูลลูกค้าเสริม (รหัสลูกค้า, ช่องทางรู้จัก, แท็ก, ข้อมูลสุขภาพ PDPA, นับการมา, ผูก LINE, แสตมป์สะสม)
create table customer_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  code_prefix text not null default 'C',
  code_pattern text not null default '{BE2}{MM}{####}',   -- {BE2} {BE4} {CE2} {CE4} {MM} {DD} + เลขรัน #### (เว้นว่าง = ค่าเริ่มต้น)
  sources jsonb,                                          -- [{key,label}] null = ค่าเริ่มต้นของระบบ
  loyalty jsonb,                                          -- {enabled,stampsRequired,countMode,rewardText,expiryMonths} null = ปิด
  updated_at timestamptz not null default now()
);
create table customer_code_counters (                     -- เลขรันไม่ขาดช่วง: แถวนี้ถูกล็อกตอนออกรหัส
  tenant_id uuid not null references tenants(id) on delete cascade,
  scope text not null,                                    -- รหัสที่ render แล้วโดยไม่รวมเลขรัน (เช่น C6910)
  last_seq int not null default 0 check (last_seq >= 0),
  primary key (tenant_id, scope)
);
create table customer_tags (                              -- แท็กของร้าน; customers.tags เก็บ "ชื่อ" แท็ก
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null, color text not null default '#0ea5e9' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index customer_tags_name_uq on customer_tags (tenant_id, lower(name));
create table customer_health (                            -- ข้อมูลอ่อนไหว PDPA: เข้ารหัส + ต้องมีวันที่/ผู้บันทึกความยินยอม
  tenant_id uuid not null, customer_id uuid not null,
  data_enc bytea not null,                                -- JSON {allergies[],allergyNote,chronicConditions[],medicationsNote}
  has_allergy boolean not null default false, has_chronic boolean not null default false,
  consent_at timestamptz not null, consent_by uuid,
  updated_by uuid, updated_at timestamptz not null default now(),
  primary key (tenant_id, customer_id),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id) on delete cascade
);
create table customer_visits (                            -- 1 แถวต่อ ลูกค้า/วัน (ตามเวลาร้าน) = 1 ครั้งที่มา
  tenant_id uuid not null, customer_id uuid not null, visit_date date not null,
  source text not null check (source in ('appointment','bill')), ref_id uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, customer_id, visit_date),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id) on delete cascade
);
create index customer_visits_ref_idx on customer_visits (tenant_id, source, ref_id);
create table customer_link_tokens (                       -- ลิงก์เชิญผูก LINE เฉพาะลูกค้า (เก็บ hash, ใช้ครั้งเดียว)
  id uuid primary key, tenant_id uuid not null, customer_id uuid not null,
  token_hash text not null unique, expires_at timestamptz not null, used_at timestamptz,
  created_by uuid, created_at timestamptz not null default now(),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id) on delete cascade
);
create index customer_link_tokens_customer_idx on customer_link_tokens (tenant_id, customer_id);
create table loyalty_redemptions (
  id uuid primary key, tenant_id uuid not null, customer_id uuid not null,
  stamps_used int not null check (stamps_used > 0), reward_text text not null, note text,
  redeemed_by uuid, redeemed_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id)
);
create index loyalty_redemptions_customer_idx on loyalty_redemptions (tenant_id, customer_id, redeemed_at desc);
create table loyalty_stamps (                             -- 1 แถวต่อ 1 แสตมป์; ใช้ได้ = ไม่ reversed, ไม่ถูกแลก, ไม่หมดอายุ
  id uuid primary key, tenant_id uuid not null, customer_id uuid not null,
  source text not null check (source in ('bill','manual')), bill_id uuid, reason text,
  earned_at timestamptz not null default now(), expires_at timestamptz,
  created_by uuid,
  reversed_at timestamptz, reversed_reason text, reversed_by uuid,
  redemption_id uuid,
  foreign key (tenant_id, customer_id) references customers(tenant_id, id),
  foreign key (tenant_id, redemption_id) references loyalty_redemptions(tenant_id, id)
);
create index loyalty_stamps_customer_idx on loyalty_stamps (tenant_id, customer_id, earned_at);
create index loyalty_stamps_bill_idx on loyalty_stamps (tenant_id, bill_id);

create table appointments (
  id uuid primary key, tenant_id uuid not null, branch_id uuid not null,
  customer_id uuid not null, service_id uuid not null,
  membership_id uuid, resource_id uuid,
  start_at timestamptz not null, end_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked','confirmed','reschedule_requested','checked_in','in_service','completed','no_show','cancelled')),
  source text not null default 'front_desk' check (source in ('front_desk','liff','phone','walk_in','import')),
  is_requested_member boolean not null default false,
  customer_package_id uuid,
  note text, custom_fields jsonb not null default '{}',
  version int not null default 1,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (end_at > start_at),
  foreign key (tenant_id, branch_id) references branches(tenant_id, id),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id),
  foreign key (tenant_id, service_id) references services(tenant_id, id),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id),
  foreign key (tenant_id, resource_id) references branch_resources(tenant_id, id),
  foreign key (tenant_id, customer_package_id) references customer_packages(tenant_id, id),
  constraint no_overlap_member exclude using gist (membership_id with =, tstzrange(start_at, end_at) with &&)
    where (membership_id is not null and status in ('booked','confirmed','checked_in','in_service')),
  constraint no_overlap_resource exclude using gist (resource_id with =, tstzrange(start_at, end_at) with &&)
    where (resource_id is not null and status in ('booked','confirmed','checked_in','in_service'))
);
create index on appointments (tenant_id, branch_id, start_at);
create index on appointments (tenant_id, membership_id, start_at);
create index on appointments (tenant_id, customer_id, start_at desc);
create trigger appointments_touch before update on appointments for each row execute function touch_updated_at();
create trigger appointments_ver   before update on appointments for each row execute function bump_version();

create table appointment_events (
  id bigserial primary key, tenant_id uuid not null, appointment_id uuid not null,
  from_status text, to_status text not null, actor_type text not null, actor_id uuid, reason text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, appointment_id) references appointments(tenant_id, id) on delete cascade
);

create table followups (
  id uuid primary key, tenant_id uuid not null, branch_id uuid, customer_id uuid not null, appointment_id uuid,
  type text not null check (type in ('post_care','no_show','rebook_due','lapsed','package_expiring','manual','concern','complaint')),
  due_at timestamptz not null, assignee_membership_id uuid,
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  status text not null default 'open' check (status in ('open','done','snoozed','cancelled')),
  outcome text check (outcome in ('ok','concern','no_answer','rebooked','declined')),
  note text, completed_by uuid, completed_at timestamptz, created_at timestamptz not null default now(),
  foreign key (tenant_id, customer_id) references customers(tenant_id, id),
  foreign key (tenant_id, assignee_membership_id) references memberships(tenant_id, id)
);
create index on followups (tenant_id, status, due_at);
create index on followups (tenant_id, assignee_membership_id, status);

-- ---------- 3. Messaging ----------
create table channel_accounts (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  provider text not null check (provider in ('line','sms','email','whatsapp','messenger')),
  name text not null, external_id text not null, secret_enc bytea, access_token_enc bytea, liff_id text,
  status text not null default 'active', quota_cache jsonb, created_at timestamptz not null default now(),
  unique (tenant_id, id), unique (provider, external_id)
);
create table message_templates (
  id uuid primary key, tenant_id uuid references tenants(id) on delete cascade,
  key text not null, trigger text not null, channel text not null default 'line', locale text not null default 'th',
  name text not null, content jsonb not null, variables text[] not null default '{}', version int not null default 1, active boolean not null default true,
  unique (tenant_id, key, locale, version)
);
create table message_plans (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  trigger text not null check (trigger in ('appointment.created','appointment.reminder','appointment.no_show','service.completed','rebook.due','package.expiring','customer.lapsed','daily_close.completed')),
  offset_minutes int not null check (offset_minutes between -20160 and 525600),
  template_key text not null, enabled boolean not null default true, branch_id uuid, service_category_id uuid
);
create table message_jobs (
  id uuid primary key, tenant_id uuid not null, customer_id uuid, appointment_id uuid, plan_id uuid, template_id uuid, channel_account_id uuid,
  send_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sent','failed','cancelled','skipped')),
  skip_reason text, attempts int not null default 0, sent_at timestamptz, provider_message_id text,
  dedupe_key text not null, created_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key)                       -- กันส่งซ้ำ เช่น "appt:{id}:reminder:-1440"
);
create index message_jobs_due on message_jobs (send_at) where status = 'scheduled';
create table message_logs (
  id bigserial primary key, tenant_id uuid not null, customer_id uuid, direction text not null check (direction in ('out','in')),
  channel text not null, content_summary text, template_key text, related jsonb, created_at timestamptz not null default now()
);

-- ---------- 4. Operations ----------
create table shift_templates (id uuid primary key, tenant_id uuid not null, branch_id uuid, name text not null, start_time time not null, end_time time not null, duties jsonb not null default '[]');
create table shifts (
  id uuid primary key, tenant_id uuid not null, branch_id uuid not null, membership_id uuid not null,
  date date not null, start_time time not null, end_time time not null, breaks jsonb not null default '[]',
  shift_template_id uuid, duties jsonb not null default '[]',
  status text not null default 'planned' check (status in ('planned','swapped','absent','leave')),
  version int not null default 1,
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id) references branches(tenant_id, id),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id),
  unique (membership_id, date, start_time)
);
create index on shifts (tenant_id, branch_id, date);
create table leave_requests (
  id uuid primary key, tenant_id uuid not null, membership_id uuid not null,
  type text not null check (type in ('sick','personal','vacation','other')),
  starts_at timestamptz not null, ends_at timestamptz not null, reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid, decided_at timestamptz, check (ends_at > starts_at),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id)
);
create table checklists (id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade, name text not null, branch_ids uuid[] not null default '{}', position_ids uuid[] not null default '{}', schedule jsonb not null, active boolean not null default true, unique (tenant_id, id));
create table checklist_items (
  id uuid primary key, tenant_id uuid not null, checklist_id uuid not null, text text not null,
  kind text not null default 'check' check (kind in ('check','count','photo','note')),
  min_count int,                                      -- kind=count: แจ้งเตือนเมื่อต่ำกว่า (เช่น ผ้าขนหนู ≥ 20)
  sort int not null default 0, unique (tenant_id, id),
  foreign key (tenant_id, checklist_id) references checklists(tenant_id, id) on delete cascade
);
create table checklist_runs (
  id uuid primary key, tenant_id uuid not null, checklist_id uuid not null, branch_id uuid not null, date date not null, shift_id uuid,
  started_by uuid, status text not null default 'open' check (status in ('open','done','overdue')), completed_at timestamptz,
  unique (tenant_id, id), unique (checklist_id, branch_id, date, shift_id)
);
create table checklist_run_items (
  tenant_id uuid not null, run_id uuid not null, item_id uuid not null,
  done boolean not null default false, count_value int, note text, photo_file_id uuid, done_by uuid, done_at timestamptz,
  primary key (run_id, item_id),
  foreign key (tenant_id, run_id) references checklist_runs(tenant_id, id) on delete cascade
);
create table sops (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null, body_md text not null, position_ids uuid[] not null default '{}', service_ids uuid[] not null default '{}',
  author_membership_id uuid,                         -- คนเก่าที่เขียน (ให้เครดิต/ค่าตอบแทน)
  version int not null default 1, published_at timestamptz, archived_at timestamptz, unique (tenant_id, id)
);
create table sop_acknowledgements (sop_id uuid references sops(id) on delete cascade, version int not null, membership_id uuid not null, acknowledged_at timestamptz not null default now(), primary key (sop_id, version, membership_id));

create table approvals (                             -- กล่องอนุมัติเดียว ใช้กับทุกเรื่อง
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade, branch_id uuid,
  kind text not null check (kind in ('leave','shift_swap','discount','void','refund','other')),
  ref_id uuid not null, requested_by uuid not null, approver_role text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decided_by uuid, decided_at timestamptz, note text, created_at timestamptz not null default now()
);
create index on approvals (tenant_id, status, created_at);

create table daily_closes (
  id uuid primary key, tenant_id uuid not null, branch_id uuid not null, date date not null,
  closed_by uuid, closed_at timestamptz, totals jsonb not null default '{}',
  declared_cash_minor bigint, declared_transfer_minor bigint, variance_minor bigint,
  handover_note text, issues jsonb not null default '[]',
  unique (branch_id, date),
  foreign key (tenant_id, branch_id) references branches(tenant_id, id)
);

create table offboardings (                          -- ขั้นตอนเมื่อมีคนลาออก
  id uuid primary key, tenant_id uuid not null, membership_id uuid not null, last_day date not null,
  status text not null default 'open' check (status in ('open','done')),
  tasks jsonb not null default '[]',                -- ส่งต่องาน, ส่งต่อลูกค้า, คืนของ, ปิดสิทธิ์
  customer_handover jsonb not null default '[]',    -- [{customerId, toMembershipId, messageSent}]
  created_at timestamptz not null default now(),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id)
);

-- ---------- 5. People voice ----------
create table question_bank (id uuid primary key, tenant_id uuid references tenants(id) on delete cascade, dimension text not null check (dimension in ('D1','D2','D3','D4','D5','D6','D7')), key text not null, text jsonb not null, scale text not null check (scale in ('likert5','nps10','text')), reverse boolean not null default false, active boolean not null default true, unique (tenant_id, key));
create table surveys (id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade, title text not null, question_ids uuid[] not null, audience jsonb not null default '{}', opens_at timestamptz not null, closes_at timestamptz not null, anonymity_threshold int not null default 5 check (anonymity_threshold >= 3), status text not null default 'draft' check (status in ('draft','open','closed')), check (closes_at > opens_at));
create table survey_tokens (id uuid primary key, tenant_id uuid not null, survey_id uuid not null references surveys(id) on delete cascade, membership_id uuid not null, token_hash text not null unique, issued_at timestamptz not null default now(), used boolean not null default false, unique (survey_id, membership_id));
-- ไม่มี membership_id / token_id โดยเจตนา
create table survey_responses (id uuid primary key, tenant_id uuid not null, survey_id uuid not null references surveys(id) on delete cascade, branch_id uuid, position_id uuid, submitted_on date not null, answers jsonb not null);
create table health_scores (id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade, branch_id uuid, period text not null, dimension text not null check (dimension in ('D1','D2','D3','D4','D5','D6','D7','overall')), score numeric(5,2) not null check (score between 0 and 100), survey_component numeric(5,2), rubric_component numeric(5,2), metric_component numeric(5,2), sample_size int not null, computed_at timestamptz not null default now());
create unique index health_scores_uq on health_scores (tenant_id, coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid), period, dimension);
create table anon_reports (id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade, branch_id uuid, category text not null, body text not null check (length(body) <= 4000), status text not null default 'new' check (status in ('new','in_progress','resolved','closed')), assignee_membership_id uuid, route_to_platform boolean not null default false, secret_hash text not null unique, created_hour timestamptz not null, resolved_at timestamptz);
create table anon_report_messages (id uuid primary key, tenant_id uuid not null, report_id uuid not null references anon_reports(id) on delete cascade, author text not null check (author in ('reporter','handler')), body text not null, created_hour timestamptz not null);
create table customer_complaints (id uuid primary key, tenant_id uuid not null, branch_id uuid, customer_id uuid, appointment_id uuid, channel text, body text not null, assignee_membership_id uuid, status text not null default 'open' check (status in ('open','in_progress','resolved')), resolution text, created_at timestamptz not null default now(), resolved_at timestamptz);

-- ---------- 6. Rules, payouts, checkout ----------
create table rule_sets (
  id uuid primary key, tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null check (kind in ('compensation','booking','discount')),
  branch_id uuid, schema_version int not null, body jsonb not null,
  effective_from date not null, created_by uuid, created_at timestamptz not null default now(),
  unique (tenant_id, kind, branch_id, effective_from)
);

create table bills (
  id uuid primary key, tenant_id uuid not null, branch_id uuid not null,
  number text not null, customer_id uuid, walk_in_name text,   -- walk_in_name: ชื่อลูกค้าเดินเข้าที่ไม่มีใน CRM (บิลจากคิว)
  appointment_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open','paid','void','refunded','partially_refunded')),
  subtotal_minor bigint not null default 0, discount_minor bigint not null default 0, discount_reason text, discount_approved_by uuid,
  total_minor bigint not null default 0, tip_minor bigint not null default 0,
  external_ref text,                                   -- เลขบิลจาก POS เดิม (ถ้าอยู่คู่)
  created_by uuid, paid_at timestamptz, version int not null default 1, created_at timestamptz not null default now(),
  unique (tenant_id, id), unique (branch_id, number),
  check (discount_minor >= 0 and discount_minor <= subtotal_minor),
  check (total_minor = subtotal_minor - discount_minor),
  check (discount_minor = 0 or discount_reason is not null)
);
create table bill_items (id uuid primary key, tenant_id uuid not null, bill_id uuid not null, kind text not null check (kind in ('service','product','package_sale','package_use')), ref_id uuid, name text not null, qty int not null default 1 check (qty > 0), unit_price_minor bigint not null check (unit_price_minor >= 0), discount_minor bigint not null default 0, performer_membership_id uuid, sale_membership_id uuid, lab_cost_minor bigint not null default 0 check (lab_cost_minor >= 0) /* migration 0024: lab cost of the whole line */, lab_vendor text, foreign key (tenant_id, bill_id) references bills(tenant_id, id) on delete cascade);
create table payments (id uuid primary key, tenant_id uuid not null, bill_id uuid not null, method text not null check (method in ('cash','transfer','promptpay','card_external','package','deposit','other')), amount_minor bigint not null check (amount_minor > 0), reference text, slip_file_id uuid, confirmed_by uuid, confirmed_at timestamptz, foreign key (tenant_id, bill_id) references bills(tenant_id, id));
create table receipts (id uuid primary key, tenant_id uuid not null, bill_id uuid not null unique, number text not null, issued_at timestamptz not null default now(), delivered_via text, file_id uuid);
create table cash_sessions (id uuid primary key, tenant_id uuid not null, branch_id uuid not null, opened_by uuid not null, opened_at timestamptz not null, opening_float_minor bigint not null default 0, closed_by uuid, closed_at timestamptz, counted_minor bigint, expected_minor bigint, variance_minor bigint, note text);
create unique index one_open_cash_session on cash_sessions (branch_id) where closed_at is null;
-- เงินเข้า/ออกลิ้นชักระหว่างกะ (ซื้อของใช้ ค่ามือ ส่งเจ้าของ/ฝากธนาคาร เติมเงินทอน) — append-only, นับรวมในเงินสดที่ควรมี
create table cash_movements (id uuid primary key, tenant_id uuid not null, branch_id uuid not null, session_id uuid not null references cash_sessions(id), kind text not null check (kind in ('in','out')), amount_minor bigint not null check (amount_minor > 0), reason text not null check (reason in ('supplies','labor','owner_deposit','change_topup','deposit_in','deposit_out','other')), note text, deposit_id uuid, created_by uuid not null, created_at timestamptz not null default now(), check ((kind = 'in' and reason in ('change_topup','deposit_in','other')) or (kind = 'out' and reason in ('supplies','labor','owner_deposit','deposit_out','other'))), check (reason <> 'other' or coalesce(length(btrim(note)), 0) > 0));
create index cash_movements_session_idx on cash_movements (session_id, created_at);
create index cash_movements_branch_idx on cash_movements (tenant_id, branch_id, created_at);
-- 0020 มัดจำ (deposits): held until applied on a bill (payments.method = 'deposit'), refunded or forfeited
create table deposits (id uuid primary key, tenant_id uuid not null, branch_id uuid not null, customer_id uuid not null, appointment_id uuid references appointments(id), amount_minor bigint not null check (amount_minor > 0), remaining_minor bigint not null, method text not null check (method in ('cash','transfer','promptpay','card_external','other')), reference text, receipt_number text not null, note text, status text not null default 'held' check (status in ('held','applied','refunded','forfeited')), taken_by uuid, taken_at timestamptz not null default now(), unique (tenant_id, id), check (remaining_minor >= 0 and remaining_minor <= amount_minor), foreign key (tenant_id, customer_id) references customers(tenant_id, id));
-- 0020: appointments.sale_membership_id uuid (ผู้ดูแล / sales person of the booking, copied to its bill line)
create index deposits_customer_idx on deposits (tenant_id, customer_id, taken_at desc);
create index deposits_branch_idx on deposits (tenant_id, branch_id, taken_at desc);
-- append-only trail: apply (on a bill) / refund / forfeit / restore (a voided bill gives the deposit back)
create table deposit_uses (id uuid primary key, tenant_id uuid not null, deposit_id uuid not null, kind text not null check (kind in ('apply','refund','forfeit','restore')), amount_minor bigint not null check (amount_minor > 0), bill_id uuid, reason text, method text, created_by uuid, created_at timestamptz not null default now(), foreign key (tenant_id, deposit_id) references deposits(tenant_id, id));
create index deposit_uses_deposit_idx on deposit_uses (deposit_id, created_at);
create index deposit_uses_day_idx on deposit_uses (tenant_id, created_at);
create table refunds (id uuid primary key, tenant_id uuid not null, bill_id uuid not null, amount_minor bigint not null check (amount_minor > 0), reason text not null, approved_by uuid not null, created_at timestamptz not null default now());
-- เลขเอกสารต่อเนื่องต่อสาขา (ห้ามข้าม)
create table doc_sequences (tenant_id uuid not null, branch_id uuid not null, doc_type text not null, prefix text not null, next_value bigint not null default 1, primary key (branch_id, doc_type));

create table service_records (
  id uuid primary key, tenant_id uuid not null, branch_id uuid not null, appointment_id uuid, bill_id uuid,
  customer_id uuid, service_id uuid not null, membership_id uuid not null, assistant_membership_ids uuid[] not null default '{}',
  performed_at timestamptz not null, price_minor bigint not null check (price_minor >= 0), discount_minor bigint not null default 0,
  paid_minor bigint not null default 0, tip_minor bigint not null default 0, customer_package_id uuid,
  lab_cost_minor bigint not null default 0 check (lab_cost_minor >= 0), -- migration 0024: `paid_after_lab` compensation base
  is_requested_by_customer boolean not null default false, sale_membership_id uuid,
  custom_fields jsonb not null default '{}', payout_period_id uuid, locked boolean not null default false,
  unique (tenant_id, id), unique (appointment_id),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id),
  foreign key (tenant_id, service_id) references services(tenant_id, id)
);
create index on service_records (tenant_id, membership_id, performed_at);
create table payout_periods (id uuid primary key, tenant_id uuid not null, branch_id uuid, starts_on date not null, ends_on date not null, status text not null default 'open' check (status in ('open','closed')), closed_by uuid, closed_at timestamptz, check (ends_on >= starts_on));
create table commission_ledger (id bigserial primary key, tenant_id uuid not null, membership_id uuid not null, service_record_id uuid, rule_set_id uuid references rule_sets(id), component text not null check (component in ('base','hand_fee','commission','tip','bonus','mentor_bonus','sop_bonus','adjustment')), amount_minor bigint not null, explain jsonb not null, created_at timestamptz not null default now());
create table payout_statements (id uuid primary key, tenant_id uuid not null, payout_period_id uuid not null references payout_periods(id), membership_id uuid not null, total_minor bigint not null, breakdown jsonb not null, file_id uuid, unique (payout_period_id, membership_id));

-- ---------- 7. Reports, KPI, impact ----------
create table kpi_snapshots (tenant_id uuid not null, branch_id uuid, kpi_key text not null, grain text not null check (grain in ('day','week','month')), period_start date not null, value numeric, numerator numeric, denominator numeric, computed_at timestamptz not null default now());
create unique index kpi_snapshots_uq on kpi_snapshots (tenant_id, coalesce(branch_id,'00000000-0000-0000-0000-000000000000'::uuid), kpi_key, grain, period_start);
create table baselines (tenant_id uuid not null references tenants(id) on delete cascade, kpi_key text not null, branch_id uuid, starts_on date not null, ends_on date not null, value numeric, primary key (tenant_id, kpi_key, starts_on));

-- "ระบบช่วยอะไรไปแล้ว" — นับทุกงานที่ระบบทำแทนคน (แสดงให้ร้านเห็นคุณค่า)
create table impact_events (
  id bigserial primary key, tenant_id uuid not null, branch_id uuid,
  kind text not null check (kind in ('reminder_sent','confirm_by_customer','followup_auto_created','overlap_prevented','payout_auto_calculated','checklist_completed','owner_decision_delegated','reschedule_self_service','report_auto_sent','no_show_recovered')),
  minutes_saved numeric(6,2) not null default 0,       -- ค่าประมาณต่องาน (ตั้งค่าได้ต่อร้าน)
  ref jsonb, created_at timestamptz not null default now()
);
create index on impact_events (tenant_id, created_at);

create table report_subscriptions (tenant_id uuid not null, report_key text not null, membership_id uuid not null, channel text not null check (channel in ('line','email','in_app')), enabled boolean not null default true, schedule_override jsonb, primary key (membership_id, report_key, channel));
create table report_runs (id uuid primary key, tenant_id uuid not null, report_key text not null, branch_id uuid, period text not null, payload jsonb not null, file_id uuid, sent_at timestamptz, created_at timestamptz not null default now());
create table usage_daily (tenant_id uuid not null, date date not null, active_members int, logins int, appointments_created int, appointments_completed int, messages_sent int, checklists_done int, customers_total int, customers_line_linked int, primary key (tenant_id, date));

-- ---------- 8. Consulting (platform) ----------
create table platform_assignments (user_id uuid references users(id), tenant_id uuid references tenants(id), role text not null check (role in ('consultant','sales')), assigned_at timestamptz not null default now(), primary key (user_id, tenant_id, role));
create table leads (id uuid primary key, business_name text not null, contact_name text, phone_enc bytea, line_id text, industry_key text, branch_count text, staff_count text, province text, pain_points text[] not null default '{}', message text, stage text not null default 'new' check (stage in ('new','contacted','checked','proposal','won','lost','nurture')), owner_user_id uuid references users(id), next_action_at timestamptz, utm jsonb, source text, leak_estimate jsonb, lost_reason text, converted_tenant_id uuid references tenants(id), created_at timestamptz not null default now());
create table lead_activities (id uuid primary key, lead_id uuid not null references leads(id) on delete cascade, type text not null check (type in ('call','chat','visit','meeting','note','proposal','free_check')), note text, at timestamptz not null, by_user_id uuid references users(id));
create table engagements (id uuid primary key, tenant_id uuid not null references tenants(id), type text not null check (type in ('free_check','workshop','small_shop_setup','audit','reset_90','retainer')), status text not null default 'proposed' check (status in ('proposed','active','completed','cancelled')), starts_on date, ends_on date, fee_minor bigint not null default 0, billing text not null default 'one_time' check (billing in ('one_time','monthly')), lead_consultant_user_id uuid references users(id), sold_by_user_id uuid references users(id), playbook_key text, notes text);
create table playbooks (key text not null, version int not null, name text not null, weeks jsonb not null, primary key (key, version));
create table engagement_tasks (id uuid primary key, engagement_id uuid not null references engagements(id) on delete cascade, week int not null, key text not null, title text not null, owner text not null check (owner in ('consultant','tenant')), status text not null default 'todo' check (status in ('todo','doing','done','skipped')), due_on date, done_at timestamptz, note text);
create table audits (id uuid primary key, tenant_id uuid not null references tenants(id), engagement_id uuid references engagements(id), status text not null default 'open', started_on date, report_file_id uuid, consultant_user_id uuid references users(id));
create table rubric_scores (id uuid primary key, tenant_id uuid not null, audit_id uuid not null references audits(id) on delete cascade, dimension text not null, criterion_key text not null, score int not null check (score between 1 and 5), evidence text, scored_by uuid, created_at timestamptz not null default now());
create table audit_findings (id uuid primary key, audit_id uuid not null references audits(id) on delete cascade, dimension text not null, severity text not null check (severity in ('low','medium','high','critical')), title text not null, body text, root_cause text, metric_key text);
create table action_plans (id uuid primary key, audit_id uuid not null references audits(id) on delete cascade, items jsonb not null);
create table vacation_tests (                         -- ทดสอบลาพักร้อน
  id uuid primary key, tenant_id uuid not null references tenants(id), engagement_id uuid references engagements(id),
  starts_on date not null, ends_on date not null, owner_membership_id uuid not null,
  result jsonb,                                        -- {ownerContacts, decisionsDelegated, noShowRate, revenueVsBaseline, issues[]}
  status text not null default 'planned' check (status in ('planned','running','done')), check (ends_on >= starts_on)
);
create table invoices (id uuid primary key, tenant_id uuid not null references tenants(id), source text not null check (source in ('subscription','engagement')), source_id uuid, number text not null unique, amount_minor bigint not null, vat_minor bigint not null default 0, issued_on date not null, due_on date not null, paid_at timestamptz, status text not null default 'issued' check (status in ('draft','issued','paid','void','overdue')), file_id uuid);
create table feature_requests (id uuid primary key, tenant_id uuid references tenants(id), title text not null, body text, requested_by uuid, category text, votes int not null default 1, status text not null default 'new' check (status in ('new','planned','done','declined')));

-- ---------- 9. RLS: เปิดทุกตารางที่มี tenant_id (ยกเว้นตาราง platform ข้าม tenant) ----------
do $$
declare t record;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_name = c.table_name and tb.table_schema = 'public' and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'tenant_id'
      and c.table_name not in ('audit_logs','outbox_events','platform_assignments','engagements','audits','invoices','vacation_tests','feature_requests','usage_daily')
  loop
    execute format('alter table %I enable row level security', t.table_name);
    execute format('alter table %I force row level security', t.table_name);
    execute format('drop policy if exists tenant_isolation on %I', t.table_name);
    execute format('create policy tenant_isolation on %I using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id())', t.table_name);
  end loop;
end $$;

-- ตารางที่มีแถวกลาง (tenant_id null = ใช้ร่วมทุกร้าน): อ่านได้ทั้งของร้านและของกลาง เขียนได้เฉพาะของร้าน
do $$
declare t text;
begin
  foreach t in array array['roles','question_bank','message_templates'] loop
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format('create policy shared_read on %I for select using (tenant_id is null or tenant_id = app_tenant_id())', t);
    execute format('create policy tenant_write on %I for insert with check (tenant_id = app_tenant_id())', t);
    execute format('create policy tenant_update on %I for update using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id())', t);
    execute format('create policy tenant_delete on %I for delete using (tenant_id = app_tenant_id())', t);
  end loop;
end $$;

-- roles (สร้างใน migration แยก พร้อมรหัสผ่านจาก secret)
-- coreup_app: nobypassrls · coreup_platform: bypassrls (ใช้เฉพาะ worker/platform service) · coreup_owner: เจ้าของ schema

-- ---------- 10. Added after the initial reference (migrations 0004–0010) ----------
-- 0004_ops_swaps_push_sop_tenant.sql
-- M4: shift swap requests (docs/03 §3.4), web push subscriptions (docs/04 §8),
-- and tenant scoping for sop_acknowledgements (previously had no tenant_id → readable across tenants).

create table shift_swap_requests (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  shift_id uuid not null,
  requested_by uuid not null,
  target_membership_id uuid,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, shift_id) references shifts(tenant_id, id) on delete cascade,
  foreign key (tenant_id, requested_by) references memberships(tenant_id, id),
  foreign key (tenant_id, target_membership_id) references memberships(tenant_id, id)
);
create index shift_swap_requests_tenant_status_idx on shift_swap_requests (tenant_id, status, created_at);
create table push_subscriptions (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  membership_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (tenant_id, membership_id, endpoint),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id) on delete cascade
);
-- migration 0021: in-app bell for staff (appointment reminders, new / cancelled LINE bookings)
create table notifications (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  membership_id uuid not null,
  kind text not null check (kind in ('appointment_soon','booking_new','booking_cancelled')),
  title text not null, body text, url text,
  ref_type text, ref_id uuid,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, membership_id) references memberships(tenant_id, id) on delete cascade
);
create unique index notifications_dedupe_uq on notifications (tenant_id, dedupe_key) where dedupe_key is not null;
create index notifications_member_idx on notifications (tenant_id, membership_id, created_at desc);
create index notifications_unread_idx on notifications (tenant_id, membership_id) where read_at is null;
alter table notifications enable row level security;
alter table notifications force row level security;
create policy tenant_isolation on notifications using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
-- migration 0022: LINE self-booking (shared LIFF app)
alter table memberships add column online_bookable boolean not null default true;
alter table memberships add column online_nickname text;
alter table memberships add column online_photo_file_id uuid references files(id) on delete set null;
alter table services add column image_file_id uuid references files(id) on delete set null;
alter table channel_accounts add column rich_menu_id text;
alter table channel_accounts add column rich_menu_installed_at timestamptz;
create table booking_deposit_requests (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  appointment_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'awaiting_slip' check (status in ('awaiting_slip','slip_submitted','confirmed','rejected')),
  slip_file_id uuid references files(id) on delete set null,
  slip_submitted_at timestamptz,
  reject_reason text,
  deposit_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, appointment_id),
  foreign key (tenant_id, appointment_id) references appointments(tenant_id, id) on delete cascade
);
create index booking_deposit_requests_status_idx on booking_deposit_requests (tenant_id, status, created_at desc);
alter table booking_deposit_requests enable row level security;
alter table booking_deposit_requests force row level security;
create policy tenant_isolation on booking_deposit_requests using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
alter table sop_acknowledgements add column tenant_id uuid;
update sop_acknowledgements a set tenant_id = s.tenant_id from sops s where s.id = a.sop_id;
alter table sop_acknowledgements alter column tenant_id set not null;
alter table sop_acknowledgements
  add constraint sop_acknowledgements_tenant_sop_fk foreign key (tenant_id, sop_id) references sops(tenant_id, id) on delete cascade,
  add constraint sop_acknowledgements_tenant_membership_fk foreign key (tenant_id, membership_id) references memberships(tenant_id, id) on delete cascade;
do $$
declare t text;
begin
  foreach t in array array['shift_swap_requests','push_subscriptions','sop_acknowledgements'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format('create policy tenant_isolation on %I using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id())', t);
    execute format('grant select, insert, update, delete on %I to coreup_app, coreup_platform', t);
  end loop;
end $$;

-- 0005_imports.sql
-- CSV imports (docs/03 §3.1, docs/02 /imports + queue import.run). `type` is open (customers|services|pos_daily…).
create table imports (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  file_id uuid,
  params jsonb not null default '{}',
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index imports_tenant_created_idx on imports (tenant_id, created_at desc);
alter table imports enable row level security;
alter table imports force row level security;
create policy tenant_isolation on imports using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on imports to coreup_app, coreup_platform;

-- 0006_followup_dedupe_two_factor.sql
-- followups: idempotent cron generation (domain followup drafts carry a dedupe key)
alter table followups add column dedupe_key text;
create unique index followups_dedupe_uq on followups (tenant_id, dedupe_key) where dedupe_key is not null;
-- Better Auth twoFactor plugin (1.7.x) columns
alter table two_factors
  add column verified boolean not null default true,
  add column failed_verification_count int not null default 0,
  add column locked_until timestamptz;
-- LINE followers (docs/02 §7.1 follow/unfollow)
create table line_followers (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  channel_account_id uuid not null,
  line_user_id text not null,
  display_name text,
  followed_at timestamptz not null default now(),
  unfollowed_at timestamptz,
  customer_id uuid,
  unique (tenant_id, id),
  unique (tenant_id, channel_account_id, line_user_id),
  foreign key (tenant_id, channel_account_id) references channel_accounts(tenant_id, id) on delete cascade,
  foreign key (tenant_id, customer_id) references customers(tenant_id, id)
);
alter table line_followers enable row level security;
alter table line_followers force row level security;
create policy tenant_isolation on line_followers using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on line_followers to coreup_app, coreup_platform;
-- Unauthenticated LINE webhook must resolve its channel account (and secret) before a tenant is known.
create policy owner_lookup on channel_accounts for select to coreup_owner using (true);
create function app_channel_account_by_id(p_id uuid)
returns table (id uuid, tenant_id uuid, provider text, status text, secret_enc bytea)
language sql stable security definer set search_path = public as $$
  select id, tenant_id, provider, status, secret_enc from channel_accounts where id = p_id
$$;
revoke all on function app_channel_account_by_id(uuid) from public;
grant execute on function app_channel_account_by_id(uuid) to coreup_app, coreup_platform;
-- AGENTS rule 16: money/history tables are append-only at the DB level (TRUNCATE unaffected).
create or replace function app_forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception '% on % is not allowed (append-only)', tg_op, tg_table_name using errcode = '23514';
end $$;
create trigger commission_ledger_append_only before update or delete on commission_ledger
  for each row execute function app_forbid_mutation();
create trigger appointment_events_append_only before update or delete on appointment_events
  for each row execute function app_forbid_mutation();
create trigger audit_logs_append_only before update or delete on audit_logs
  for each row execute function app_forbid_mutation();
create trigger cash_movements_append_only before update or delete on cash_movements
  for each row execute function app_forbid_mutation();
create trigger deposit_uses_append_only before update or delete on deposit_uses
  for each row execute function app_forbid_mutation();

-- 0007_refund_method.sql
-- Refunds record how money was paid back (cash drawer expected value, docs/11 §4)
alter table refunds add column method text not null default 'cash'
  check (method in ('cash','transfer','promptpay','card_external','other'));

-- 0008_message_job_vars.sql
-- one-off messages carry their own template variables (e.g. receipts from Checkout)
alter table message_jobs add column vars jsonb not null default '{}'::jsonb;

-- 0009_rls_vacation_invoices.sql
-- Defense in depth: vacation_tests and invoices are read/written by shop-side routes inside withTenantTx
-- (KpiReports billing/vacation). Platform code reaches them through the bypassrls coreup_platform role.
do $$
declare t text;
begin
  foreach t in array array['vacation_tests','invoices'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format('create policy tenant_isolation on %I using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id())', t);
  end loop;
end $$;

-- 0010_invoice_number_lookup.sql
-- Invoice numbers are global (INV-YYYYMM-####) but invoices are RLS-scoped since 0009, so a shop-side
-- transaction cannot see other shops' numbers. Expose only the last number for a prefix.
create policy owner_lookup on invoices for select to coreup_owner using (true);
create function app_last_invoice_number(p_prefix text) returns text
language sql stable security definer set search_path = public as $$
  select max(number) from invoices where number like p_prefix || '%'
$$;
revoke all on function app_last_invoice_number(text) from public;
grant execute on function app_last_invoice_number(text) to coreup_app, coreup_platform;

-- 0017_accounting.sql
-- CoreUp's own accounting (team console, /v1/platform/accounting). Every row belongs to the platform tenant
-- (`coreup`) and sits under tenant RLS like any shop table. Idempotent: production runs migrate on every deploy.
-- Money = bigint satang. Document numbers are allocated gap-free from acc_sequences (row locked FOR UPDATE).

create table if not exists acc_company (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  legal_name text not null,
  legal_name_en text,
  tax_id text,
  branch_code text not null default '00000',
  branch_name text,
  address text,
  phone text,
  email text,
  website text,
  logo_file_id uuid,
  vat_registered boolean not null default false,
  vat_rate_bp integer not null default 700,
  prefixes jsonb not null default '{"quotation":"QT","invoice":"IV","receipt":"RE","taxInvoice":"TX","creditNote":"CN"}'::jsonb,
  number_format text not null default '{PREFIX}-{BE}{MM}-{SEQ}',
  seq_digits smallint not null default 4,
  default_due_days integer not null default 30,
  quotation_valid_days integer not null default 30,
  default_note text,
  bank_accounts jsonb not null default '[]'::jsonb,
  signers jsonb not null default '{"issuer":null,"approver":null}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table if not exists acc_contacts (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,
  name text not null,
  tax_id text,
  branch_code text,
  address text,
  contact_person text,
  phone_enc bytea,
  email_enc bytea,
  note text,
  linked_tenant_id uuid references tenants(id),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint acc_contacts_kind_check check (kind in ('customer','vendor','both'))
);
create index if not exists acc_contacts_name_idx on acc_contacts (tenant_id, name);
create table if not exists acc_items (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  code text,
  name text not null,
  description text,
  unit text,
  unit_price_minor bigint not null default 0,
  vat_type text not null default 'vat',
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint acc_items_vat_type_check check (vat_type in ('vat','none','exempt')),
  constraint acc_items_price_check check (unit_price_minor >= 0)
);
create index if not exists acc_items_name_idx on acc_items (tenant_id, name);
create table if not exists acc_expense_categories (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);
create unique index if not exists acc_expense_categories_name_uq on acc_expense_categories (tenant_id, name);
create table if not exists acc_sequences (
  tenant_id uuid not null references tenants(id) on delete cascade,
  doc_type text not null,
  period text not null,
  next_value integer not null default 1,
  primary key (tenant_id, doc_type, period),
  constraint acc_sequences_doc_type_check check (doc_type in ('quotation','invoice','receipt','tax_invoice','credit_note')),
  constraint acc_sequences_next_check check (next_value >= 1)
);
create table if not exists acc_documents (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null,
  number text,
  status text not null default 'draft',
  doc_date date not null,
  due_date date,
  contact_id uuid references acc_contacts(id),
  contact_snapshot jsonb not null,
  issuer_snapshot jsonb,
  reference text,
  vat_mode text not null,
  vat_rate_bp integer not null default 700,
  wht_bp integer not null default 0,
  lines_total_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  taxable_minor bigint not null default 0,
  exempt_minor bigint not null default 0,
  vat_minor bigint not null default 0,
  total_minor bigint not null default 0,
  wht_minor bigint not null default 0,
  net_minor bigint not null default 0,
  settled_minor bigint not null default 0,
  credited_minor bigint not null default 0,
  note text,
  internal_note text,
  ref_document_id uuid,
  converted_to_id uuid,
  receipt_for_payment_id uuid,
  issued_at timestamp with time zone,
  issued_by uuid,
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint acc_documents_type_check check (type in ('quotation','invoice','receipt','tax_invoice','credit_note')),
  constraint acc_documents_status_check check (status in ('draft','sent','accepted','rejected','expired','issued','partially_paid','paid','void')),
  constraint acc_documents_vat_mode_check check (vat_mode in ('exclusive','inclusive','none')),
  constraint acc_documents_wht_check check (wht_bp in (0,100,200,300,500)),
  constraint acc_documents_number_check check (status = 'draft' or number is not null)
);
create unique index if not exists acc_documents_number_uq on acc_documents (tenant_id, type, number);
create index if not exists acc_documents_list_idx on acc_documents (tenant_id, type, doc_date);
create index if not exists acc_documents_contact_idx on acc_documents (tenant_id, contact_id);
create index if not exists acc_documents_ref_idx on acc_documents (ref_document_id);
create table if not exists acc_document_lines (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references acc_documents(id) on delete cascade,
  position integer not null,
  item_id uuid,
  description text not null,
  qty numeric(14,3) not null,
  unit text,
  unit_price_minor bigint not null,
  discount_minor bigint not null default 0,
  vat_type text not null,
  amount_minor bigint not null,
  constraint acc_document_lines_vat_type_check check (vat_type in ('vat','none','exempt')),
  constraint acc_document_lines_qty_check check (qty > 0)
);
create index if not exists acc_document_lines_doc_idx on acc_document_lines (document_id, position);
create table if not exists acc_payments (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references acc_documents(id),
  paid_on date not null,
  method text not null,
  account text,
  reference text,
  amount_minor bigint not null,
  wht_minor bigint not null default 0,
  wht_certificate_file_id uuid,
  receipt_id uuid,
  note text,
  status text not null default 'active',
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  constraint acc_payments_method_check check (method in ('cash','transfer','promptpay','card','cheque')),
  constraint acc_payments_status_check check (status in ('active','void')),
  constraint acc_payments_amount_check check (amount_minor >= 0 and wht_minor >= 0 and amount_minor + wht_minor > 0)
);
create index if not exists acc_payments_doc_idx on acc_payments (document_id);
create index if not exists acc_payments_paid_on_idx on acc_payments (tenant_id, paid_on);
create table if not exists acc_expenses (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  contact_id uuid references acc_contacts(id),
  vendor_name text not null,
  vendor_tax_id text,
  vendor_branch_code text,
  expense_date date not null,
  category_id uuid not null references acc_expense_categories(id),
  reference text,
  description text,
  vat_mode text not null,
  vat_rate_bp integer not null default 700,
  vat_claimable boolean not null default true,
  wht_bp integer not null default 0,
  lines jsonb not null default '[]'::jsonb,
  lines_total_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  taxable_minor bigint not null default 0,
  exempt_minor bigint not null default 0,
  vat_minor bigint not null default 0,
  total_minor bigint not null default 0,
  wht_minor bigint not null default 0,
  net_minor bigint not null default 0,
  payment_status text not null default 'unpaid',
  paid_on date,
  payment_method text,
  payment_account text,
  receipt_file_id uuid,
  note text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint acc_expenses_vat_mode_check check (vat_mode in ('exclusive','inclusive','none')),
  constraint acc_expenses_wht_check check (wht_bp in (0,100,200,300,500)),
  constraint acc_expenses_payment_status_check check (payment_status in ('unpaid','paid')),
  constraint acc_expenses_paid_check check (payment_status = 'unpaid' or paid_on is not null)
);
create index if not exists acc_expenses_list_idx on acc_expenses (tenant_id, expense_date);
create index if not exists acc_expenses_category_idx on acc_expenses (category_id);
alter table acc_company enable row level security;
alter table acc_company force row level security;
drop policy if exists tenant_isolation on acc_company;
create policy tenant_isolation on acc_company
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_company to coreup_app, coreup_platform;
alter table acc_contacts enable row level security;
alter table acc_contacts force row level security;
drop policy if exists tenant_isolation on acc_contacts;
create policy tenant_isolation on acc_contacts
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_contacts to coreup_app, coreup_platform;
alter table acc_items enable row level security;
alter table acc_items force row level security;
drop policy if exists tenant_isolation on acc_items;
create policy tenant_isolation on acc_items
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_items to coreup_app, coreup_platform;
alter table acc_expense_categories enable row level security;
alter table acc_expense_categories force row level security;
drop policy if exists tenant_isolation on acc_expense_categories;
create policy tenant_isolation on acc_expense_categories
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_expense_categories to coreup_app, coreup_platform;
alter table acc_sequences enable row level security;
alter table acc_sequences force row level security;
drop policy if exists tenant_isolation on acc_sequences;
create policy tenant_isolation on acc_sequences
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_sequences to coreup_app, coreup_platform;
alter table acc_documents enable row level security;
alter table acc_documents force row level security;
drop policy if exists tenant_isolation on acc_documents;
create policy tenant_isolation on acc_documents
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_documents to coreup_app, coreup_platform;
alter table acc_document_lines enable row level security;
alter table acc_document_lines force row level security;
drop policy if exists tenant_isolation on acc_document_lines;
create policy tenant_isolation on acc_document_lines
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_document_lines to coreup_app, coreup_platform;
alter table acc_payments enable row level security;
alter table acc_payments force row level security;
drop policy if exists tenant_isolation on acc_payments;
create policy tenant_isolation on acc_payments
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_payments to coreup_app, coreup_platform;
alter table acc_expenses enable row level security;
alter table acc_expenses force row level security;
drop policy if exists tenant_isolation on acc_expenses;
create policy tenant_isolation on acc_expenses
  using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id());
grant select, insert, update, delete on acc_expenses to coreup_app, coreup_platform;
