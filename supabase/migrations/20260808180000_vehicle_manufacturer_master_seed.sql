begin;

create index if not exists vehicle_manufacturers_created_by_idx on public.vehicle_manufacturers(created_by);
create index if not exists vehicle_manufacturers_updated_by_idx on public.vehicle_manufacturers(updated_by);
drop index if exists public.vehicle_manufacturer_brands_slug_key;
create index if not exists vehicle_manufacturer_brands_slug_idx
  on public.vehicle_manufacturer_brands(lower(slug))
  where slug is not null;

create temporary table _vehicle_manufacturer_seed (
  manufacturer_code text primary key,
  legal_name text not null,
  display_name text not null,
  slug text not null,
  market_status text not null,
  segments text not null,
  brands text not null,
  logo_path text,
  source_name text not null,
  source_url text not null,
  sort_order integer not null
) on commit drop;

insert into _vehicle_manufacturer_seed
(manufacturer_code,legal_name,display_name,slug,market_status,segments,brands,logo_path,source_name,source_url,sort_order)
values
('OEM-ASHOK-LEYLAND','Ashok Leyland Limited','Ashok Leyland','ashok-leyland','current','COMMERCIAL_VEHICLE|ELECTRIC_VEHICLE','Ashok Leyland','/assets/vehicle-brands/ashok-leyland.svg','SIAM','https://www.siam.in/about-us/members',10),
('OEM-ATHER','Ather Energy Limited','Ather Energy','ather-energy','current','TWO_WHEELER|ELECTRIC_VEHICLE','Ather',null,'SIAM','https://www.siam.in/about-us/members',20),
('OEM-ATUL-AUTO','Atul Auto Limited','Atul Auto','atul-auto','current','THREE_WHEELER|ELECTRIC_VEHICLE','Atul',null,'SIAM','https://www.siam.in/about-us/members',30),
('OEM-BAJAJ-AUTO','Bajaj Auto Limited','Bajaj Auto','bajaj-auto','current','TWO_WHEELER|THREE_WHEELER|ELECTRIC_VEHICLE','Bajaj',null,'SIAM','https://www.siam.in/about-us/members',40),
('OEM-BAXY','Baxy Limited','Baxy','baxy','current','THREE_WHEELER|ELECTRIC_VEHICLE','Baxy',null,'SIAM','https://www.siam.in/about-us/members',50),
('OEM-BMW-INDIA','BMW India Private Limited','BMW India','bmw-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','BMW|MINI',null,'SIAM','https://www.siam.in/about-us/members',60),
('OEM-CUMMINS-INDIA','Cummins India Limited','Cummins India','cummins-india','current','COMMERCIAL_VEHICLE|SPECIAL_PURPOSE','Cummins',null,'SIAM','https://www.siam.in/about-us/members',70),
('OEM-DICV','Daimler India Commercial Vehicles Private Limited','Daimler India Commercial Vehicles','daimler-india-commercial-vehicles','current','COMMERCIAL_VEHICLE','BharatBenz',null,'SIAM','https://www.siam.in/about-us/members',80),
('OEM-FIAT-INDIA','Fiat India Automobiles Private Limited','Fiat India Automobiles','fiat-india-automobiles','current','PASSENGER_VEHICLE','Fiat',null,'SIAM','https://www.siam.in/about-us/members',90),
('OEM-FORCE-MOTORS','Force Motors Limited','Force Motors','force-motors','current','PASSENGER_VEHICLE|COMMERCIAL_VEHICLE|TRACTOR_AGRICULTURAL|SPECIAL_PURPOSE','Force',null,'SIAM|TMA','https://www.siam.in/about-us/members',100),
('OEM-FOTON-INDIA','Foton Motors Manufacturing India Private Limited','Foton Motors India','foton-motors-india','current','COMMERCIAL_VEHICLE','Foton',null,'SIAM','https://www.siam.in/about-us/members',110),
('OEM-GREAVES-COTTON','Greaves Cotton Limited','Greaves Cotton','greaves-cotton','current','THREE_WHEELER|ELECTRIC_VEHICLE|SPECIAL_PURPOSE','Greaves|Ampere',null,'SIAM','https://www.siam.in/about-us/members',120),
('OEM-HERO-MOTOCORP','Hero MotoCorp Limited','Hero MotoCorp','hero-motocorp','current','TWO_WHEELER|ELECTRIC_VEHICLE','Hero|Vida',null,'SIAM','https://www.siam.in/about-us/members',130),
('OEM-HONDA-CARS','Honda Cars India Limited','Honda Cars India','honda-cars-india','current','PASSENGER_VEHICLE','Honda','/assets/vehicle-brands/honda.svg','SIAM','https://www.siam.in/about-us/members',140),
('OEM-HONDA-2W','Honda Motorcycle & Scooter India Private Limited','Honda Motorcycle & Scooter India','honda-motorcycle-scooter-india','current','TWO_WHEELER','Honda','/assets/vehicle-brands/honda.svg','SIAM','https://www.siam.in/about-us/members',150),
('OEM-HYUNDAI','Hyundai Motor India Limited','Hyundai Motor India','hyundai-motor-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Hyundai','/assets/vehicle-brands/hyundai.svg','SIAM','https://www.siam.in/about-us/members',160),
('OEM-KAWASAKI','India Kawasaki Motors Private Limited','India Kawasaki Motors','india-kawasaki-motors','current','TWO_WHEELER','Kawasaki',null,'SIAM','https://www.siam.in/about-us/members',170),
('OEM-YAMAHA','India Yamaha Motor Private Limited','India Yamaha Motor','india-yamaha-motor','current','TWO_WHEELER','Yamaha',null,'SIAM','https://www.siam.in/about-us/members',180),
('OEM-ISUZU','Isuzu Motors India Private Limited','Isuzu Motors India','isuzu-motors-india','current','PASSENGER_VEHICLE|COMMERCIAL_VEHICLE','Isuzu',null,'SIAM','https://www.siam.in/about-us/members',190),
('OEM-JLR','Jaguar Land Rover India Limited','Jaguar Land Rover India','jaguar-land-rover-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Jaguar|Land Rover|Range Rover',null,'SIAM','https://www.siam.in/about-us/members',200),
('OEM-JBM-AUTO','JBM Auto Limited','JBM Auto','jbm-auto','current','COMMERCIAL_VEHICLE|ELECTRIC_VEHICLE','JBM',null,'SIAM','https://www.siam.in/about-us/members',210),
('OEM-JSW-GREENTECH','JSW Greentech Limited','JSW Greentech','jsw-greentech','current','ELECTRIC_VEHICLE|PASSENGER_VEHICLE','JSW',null,'SIAM','https://www.siam.in/about-us/members',220),
('OEM-JSW-MG','JSW MG Motor India Private Limited','JSW MG Motor India','jsw-mg-motor-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','MG',null,'SIAM','https://www.siam.in/about-us/members',230),
('OEM-KIA','Kia India Private Limited','Kia India','kia-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Kia','/assets/vehicle-brands/kia.svg','SIAM','https://www.siam.in/about-us/members',240),
('OEM-MAHINDRA','Mahindra & Mahindra Limited','Mahindra','mahindra','current','PASSENGER_VEHICLE|COMMERCIAL_VEHICLE|THREE_WHEELER|TRACTOR_AGRICULTURAL|ELECTRIC_VEHICLE','Mahindra|Mahindra Tractors','/assets/vehicle-brands/mahindra.svg','SIAM|TMA','https://www.siam.in/about-us/members',250),
('OEM-MAHINDRA-ELECTRIC','Mahindra Electric Automobile Limited','Mahindra Electric Automobile','mahindra-electric-automobile','current','ELECTRIC_VEHICLE|PASSENGER_VEHICLE','Mahindra Electric','/assets/vehicle-brands/mahindra.svg','SIAM','https://www.siam.in/about-us/members',260),
('OEM-MARUTI-SUZUKI','Maruti Suzuki India Limited','Maruti Suzuki','maruti-suzuki','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Maruti Suzuki|Maruti','/assets/vehicle-brands/maruti-suzuki.svg','SIAM','https://www.siam.in/about-us/members',270),
('OEM-MERCEDES-BENZ','Mercedes-Benz India Private Limited','Mercedes-Benz India','mercedes-benz-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Mercedes-Benz|Mercedes',null,'SIAM','https://www.siam.in/about-us/members',280),
('OEM-NISSAN','Nissan Motor India Private Limited','Nissan Motor India','nissan-motor-india','current','PASSENGER_VEHICLE','Nissan|Datsun',null,'SIAM','https://www.siam.in/about-us/members',290),
('OEM-OLECTRA','Olectra Greentech Limited','Olectra Greentech','olectra-greentech','current','COMMERCIAL_VEHICLE|ELECTRIC_VEHICLE','Olectra',null,'SIAM','https://www.siam.in/about-us/members',300),
('OEM-PIAGGIO','Piaggio Vehicles Private Limited','Piaggio Vehicles','piaggio-vehicles','current','THREE_WHEELER|ELECTRIC_VEHICLE','Piaggio|Ape',null,'SIAM','https://www.siam.in/about-us/members',310),
('OEM-EKA','Pinnacle Mobility Solutions Private Limited','Pinnacle Mobility Solutions','pinnacle-mobility-solutions','current','COMMERCIAL_VEHICLE|ELECTRIC_VEHICLE','EKA',null,'SIAM','https://www.siam.in/about-us/members',320),
('OEM-PMI','PMI Electro Mobility Solutions Private Limited','PMI Electro Mobility Solutions','pmi-electro-mobility','current','COMMERCIAL_VEHICLE|ELECTRIC_VEHICLE','PMI',null,'SIAM','https://www.siam.in/about-us/members',330),
('OEM-RENAULT','Renault India Private Limited','Renault India','renault-india','current','PASSENGER_VEHICLE','Renault',null,'SIAM','https://www.siam.in/about-us/members',340),
('OEM-RIVER','River Mobility Private Limited','River Mobility','river-mobility','current','TWO_WHEELER|ELECTRIC_VEHICLE','River',null,'SIAM','https://www.siam.in/about-us/members',350),
('OEM-EICHER-MOTORS','Eicher Motors Limited','Eicher Motors','eicher-motors','current','TWO_WHEELER','Royal Enfield',null,'SIAM','https://www.siam.in/about-us/members',360),
('OEM-SCANIA','Scania Commercial Vehicles India Private Limited','Scania Commercial Vehicles India','scania-commercial-vehicles-india','current','COMMERCIAL_VEHICLE','Scania',null,'SIAM','https://www.siam.in/about-us/members',370),
('OEM-SIMPSON','Simpson & Co. Limited','Simpson & Co.','simpson-and-co','current','SPECIAL_PURPOSE|TRACTOR_AGRICULTURAL','Simpson',null,'SIAM','https://www.siam.in/about-us/members',380),
('OEM-SAVWIPL','Skoda Auto Volkswagen India Private Limited','Skoda Auto Volkswagen India','skoda-auto-volkswagen-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Skoda|Volkswagen|Audi|Porsche|Lamborghini',null,'SIAM','https://www.siam.in/about-us/members',390),
('OEM-SML-MAHINDRA','SML Mahindra Limited','SML Mahindra','sml-mahindra','current','COMMERCIAL_VEHICLE','SML Mahindra|SML Isuzu',null,'SIAM','https://www.siam.in/about-us/members',400),
('OEM-STELLANTIS','Stellantis India Private Limited','Stellantis India','stellantis-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Jeep|Citroen',null,'SIAM','https://www.siam.in/about-us/members',410),
('OEM-SUZUKI-MOTORCYCLE','Suzuki Motorcycle India Private Limited','Suzuki Motorcycle India','suzuki-motorcycle-india','current','TWO_WHEELER','Suzuki',null,'SIAM','https://www.siam.in/about-us/members',420),
('OEM-SWITCH','Switch Mobility Automotive Limited','Switch Mobility','switch-mobility','current','COMMERCIAL_VEHICLE|ELECTRIC_VEHICLE','Switch Mobility',null,'SIAM','https://www.siam.in/about-us/members',430),
('OEM-TATA-MOTORS','Tata Motors Limited','Tata Motors','tata-motors','current','COMMERCIAL_VEHICLE|PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Tata','/assets/vehicle-brands/tata.svg','SIAM','https://www.siam.in/about-us/members',440),
('OEM-TATA-PASSENGER','Tata Motors Passenger Vehicles Limited','Tata Motors Passenger Vehicles','tata-motors-passenger-vehicles','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Tata','/assets/vehicle-brands/tata.svg','SIAM','https://www.siam.in/about-us/members',450),
('OEM-MONTRA','TI Clean Mobility Private Limited','TI Clean Mobility','ti-clean-mobility','current','THREE_WHEELER|COMMERCIAL_VEHICLE|ELECTRIC_VEHICLE','Montra Electric',null,'SIAM','https://www.siam.in/about-us/members',460),
('OEM-TOYOTA','Toyota Kirloskar Motor Private Limited','Toyota','toyota','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Toyota','/assets/vehicle-brands/toyota.svg','SIAM','https://www.siam.in/about-us/members',470),
('OEM-TRIUMPH','Triumph Motorcycles (India) Private Limited','Triumph Motorcycles India','triumph-motorcycles-india','current','TWO_WHEELER','Triumph',null,'SIAM','https://www.siam.in/about-us/members',480),
('OEM-TVS','TVS Motor Company Limited','TVS Motor Company','tvs-motor-company','current','TWO_WHEELER|THREE_WHEELER|ELECTRIC_VEHICLE','TVS',null,'SIAM','https://www.siam.in/about-us/members',490),
('OEM-VECV','VE Commercial Vehicles Limited','VE Commercial Vehicles','ve-commercial-vehicles','current','COMMERCIAL_VEHICLE','Eicher|Volvo Trucks',null,'SIAM','https://www.siam.in/about-us/members',500),
('OEM-VINFAST','VinFast Auto India Private Limited','VinFast Auto India','vinfast-auto-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','VinFast',null,'SIAM','https://www.siam.in/about-us/members',510),
('OEM-VOLVO-AUTO','Volvo Auto India Private Limited','Volvo Auto India','volvo-auto-india','current','PASSENGER_VEHICLE|ELECTRIC_VEHICLE','Volvo',null,'SIAM','https://www.siam.in/about-us/members',520),
('OEM-ACE','Action Construction Equipment Limited','Action Construction Equipment','action-construction-equipment','current','TRACTOR_AGRICULTURAL|CONSTRUCTION_EQUIPMENT|MATERIAL_HANDLING','ACE',null,'TMA','https://www.tmaindia.in/member-companies.php',530),
('OEM-CAPTAIN-TRACTORS','Captain Tractors Private Limited','Captain Tractors','captain-tractors','current','TRACTOR_AGRICULTURAL','Captain',null,'TMA','https://www.tmaindia.in/member-companies.php',540),
('OEM-ESCORTS-KUBOTA','Escorts Kubota Limited','Escorts Kubota','escorts-kubota','current','TRACTOR_AGRICULTURAL|CONSTRUCTION_EQUIPMENT','Farmtrac|Powertrac|Escorts Kubota',null,'TMA|OFFICIAL','https://www.tmaindia.in/member-companies.php',550),
('OEM-GROMAX','Gromax Agri Equipment Limited','Gromax Agri Equipment','gromax-agri-equipment','current','TRACTOR_AGRICULTURAL','Trakstar|Gromax',null,'TMA','https://www.tmaindia.in/member-companies.php',560),
('OEM-INDO-FARM','Indo Farm Equipment Limited','Indo Farm Equipment','indo-farm-equipment','current','TRACTOR_AGRICULTURAL|CONSTRUCTION_EQUIPMENT|MATERIAL_HANDLING','Indo Farm|Indo Power',null,'TMA|OFFICIAL','https://www.tmaindia.in/member-companies.php',570),
('OEM-INTERNATIONAL-TRACTORS','International Tractors Limited','International Tractors','international-tractors','current','TRACTOR_AGRICULTURAL','Sonalika|Solis',null,'TMA','https://www.tmaindia.in/member-companies.php',580),
('OEM-JOHN-DEERE','John Deere India Private Limited','John Deere India','john-deere-india','current','TRACTOR_AGRICULTURAL','John Deere',null,'TMA','https://www.tmaindia.in/member-companies.php',590),
('OEM-KUBOTA-AGRI','Kubota Agricultural Machinery India Private Limited','Kubota Agricultural Machinery India','kubota-agricultural-machinery-india','current','TRACTOR_AGRICULTURAL','Kubota',null,'TMA','https://www.tmaindia.in/member-companies.php',600),
('OEM-NEW-HOLLAND','CNH Industrial (India) Private Limited','CNH Industrial India','cnh-industrial-india','current','TRACTOR_AGRICULTURAL|CONSTRUCTION_EQUIPMENT','New Holland|CASE IH',null,'TMA','https://www.tmaindia.in/member-companies.php',610),
('OEM-PREET','Preet Tractors Private Limited','Preet Tractors','preet-tractors','current','TRACTOR_AGRICULTURAL|CONSTRUCTION_EQUIPMENT','Preet',null,'TMA','https://www.tmaindia.in/member-companies.php',620),
('OEM-DEUTZ-FAHR','SAME Deutz-Fahr India Private Limited','SAME Deutz-Fahr India','same-deutz-fahr-india','current','TRACTOR_AGRICULTURAL','Deutz-Fahr|SAME',null,'TMA','https://www.tmaindia.in/member-companies.php',630),
('OEM-TAFE','Tractors and Farm Equipment Limited','TAFE','tafe','current','TRACTOR_AGRICULTURAL','TAFE|Massey Ferguson|Eicher Tractors',null,'TMA','https://www.tmaindia.in/member-companies.php',640),
('OEM-VST','VST Tillers Tractors Limited','VST Tillers Tractors','vst-tillers-tractors','current','TRACTOR_AGRICULTURAL','VST',null,'TMA','https://www.tmaindia.in/member-companies.php',650),
('OEM-JCB','JCB India Limited','JCB India','jcb-india','current','CONSTRUCTION_EQUIPMENT|EARTHMOVING_MINING|MATERIAL_HANDLING','JCB',null,'ICEMA','https://www.i-cema.in/governing-council/',660),
('OEM-CATERPILLAR','Caterpillar India Private Limited','Caterpillar India','caterpillar-india','current','CONSTRUCTION_EQUIPMENT|EARTHMOVING_MINING|MATERIAL_HANDLING','Caterpillar|CAT',null,'ICEMA','https://www.i-cema.in/governing-council/',670),
('OEM-TATA-HITACHI','Tata Hitachi Construction Machinery Company Private Limited','Tata Hitachi Construction Machinery','tata-hitachi-construction-machinery','current','CONSTRUCTION_EQUIPMENT|EARTHMOVING_MINING','Tata Hitachi',null,'ICEMA','https://www.i-cema.in/governing-council/',680),
('OEM-SCHWING-STETTER','Schwing Stetter India Private Limited','Schwing Stetter India','schwing-stetter-india','current','CONSTRUCTION_EQUIPMENT','Schwing Stetter',null,'ICEMA','https://www.i-cema.in/governing-council/',690),
('OEM-AMMANN','Ammann India Private Limited','Ammann India','ammann-india','current','CONSTRUCTION_EQUIPMENT','Ammann',null,'ICEMA','https://www.i-cema.in/governing-council/',700),
('OEM-CASE-CE','CASE Construction Equipment India Private Limited','CASE Construction Equipment India','case-construction-equipment-india','current','CONSTRUCTION_EQUIPMENT|EARTHMOVING_MINING','CASE',null,'ICEMA','https://www.i-cema.in/governing-council/',710),
('OEM-KOBELCO','Kobelco Construction Equipment India Private Limited','Kobelco Construction Equipment India','kobelco-construction-equipment-india','current','CONSTRUCTION_EQUIPMENT|EARTHMOVING_MINING','Kobelco',null,'ICEMA','https://www.i-cema.in/governing-council/',720),
('OEM-SANY','Sany Heavy Industry India Private Limited','Sany Heavy Industry India','sany-heavy-industry-india','current','CONSTRUCTION_EQUIPMENT|EARTHMOVING_MINING|MATERIAL_HANDLING','SANY',null,'ICEMA','https://www.i-cema.in/governing-council/',730),
('OEM-TEREX','Terex India Private Limited','Terex India','terex-india','current','CONSTRUCTION_EQUIPMENT|MATERIAL_HANDLING','Terex',null,'ICEMA','https://www.i-cema.in/governing-council/',740),
('OEM-WIRTGEN','Wirtgen India Private Limited','Wirtgen India','wirtgen-india','current','CONSTRUCTION_EQUIPMENT','Wirtgen|Vogele|Hamm|Kleemann',null,'ICEMA','https://www.i-cema.in/governing-council/',750),
('OEM-FORD-INDIA','Ford India Private Limited','Ford India','ford-india','legacy','PASSENGER_VEHICLE','Ford',null,'LEGACY','https://www.ford.co.in/',760),
('OEM-GM-INDIA','General Motors India Private Limited','General Motors India','general-motors-india','legacy','PASSENGER_VEHICLE','Chevrolet|Opel',null,'LEGACY','https://www.chevrolet.co.in/',770),
('OEM-HINDUSTAN-MOTORS','Hindustan Motors Limited','Hindustan Motors','hindustan-motors','legacy','PASSENGER_VEHICLE','Hindustan Motors|Ambassador|Mitsubishi',null,'LEGACY','https://www.hindmotor.com/',780),
('OEM-PREMIER','Premier Limited','Premier','premier','legacy','PASSENGER_VEHICLE','Premier',null,'LEGACY','https://www.premier.co.in/',790);

-- Preserve the eight original row IDs by converting those starter rows in place.
update public.vehicle_manufacturers vm
set manufacturer_code = seed.manufacturer_code,
    name = seed.legal_name,
    display_name = seed.display_name,
    slug = seed.slug,
    market_status = seed.market_status,
    logo_path = seed.logo_path,
    logo_status = case when seed.logo_path is null then 'missing' else 'verified' end,
    source_name = seed.source_name,
    source_url = seed.source_url,
    source_verified_at = timestamptz '2026-08-08 00:00:00+05:30',
    sort_order = seed.sort_order,
    is_active = true
from _vehicle_manufacturer_seed seed
where (vm.slug = 'ashok-leyland' and seed.manufacturer_code = 'OEM-ASHOK-LEYLAND')
   or (vm.slug = 'honda' and seed.manufacturer_code = 'OEM-HONDA-CARS')
   or (vm.slug = 'hyundai' and seed.manufacturer_code = 'OEM-HYUNDAI')
   or (vm.slug = 'kia' and seed.manufacturer_code = 'OEM-KIA')
   or (vm.slug = 'mahindra' and seed.manufacturer_code = 'OEM-MAHINDRA')
   or (vm.slug = 'maruti-suzuki' and seed.manufacturer_code = 'OEM-MARUTI-SUZUKI')
   or (vm.slug = 'tata-motors' and seed.manufacturer_code = 'OEM-TATA-MOTORS')
   or (vm.slug = 'toyota' and seed.manufacturer_code = 'OEM-TOYOTA');

insert into public.vehicle_manufacturers (
  manufacturer_code,name,display_name,slug,market_status,logo_path,logo_status,
  source_name,source_url,source_verified_at,sort_order,is_active
)
select
  seed.manufacturer_code,seed.legal_name,seed.display_name,seed.slug,seed.market_status,seed.logo_path,
  case when seed.logo_path is null then 'missing' else 'verified' end,
  seed.source_name,seed.source_url,timestamptz '2026-08-08 00:00:00+05:30',seed.sort_order,true
from _vehicle_manufacturer_seed seed
where not exists (
  select 1 from public.vehicle_manufacturers vm
  where lower(vm.manufacturer_code) = lower(seed.manufacturer_code)
)
on conflict (name) do update set
  manufacturer_code = excluded.manufacturer_code,
  display_name = excluded.display_name,
  slug = excluded.slug,
  market_status = excluded.market_status,
  logo_path = excluded.logo_path,
  logo_status = excluded.logo_status,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  source_verified_at = excluded.source_verified_at,
  sort_order = excluded.sort_order,
  is_active = true;

update public.vehicle_manufacturers vm
set name = seed.legal_name,
    display_name = seed.display_name,
    slug = seed.slug,
    market_status = seed.market_status,
    logo_path = seed.logo_path,
    logo_status = case when seed.logo_path is null then 'missing' else 'verified' end,
    source_name = seed.source_name,
    source_url = seed.source_url,
    source_verified_at = timestamptz '2026-08-08 00:00:00+05:30',
    sort_order = seed.sort_order,
    is_active = true
from _vehicle_manufacturer_seed seed
where lower(vm.manufacturer_code) = lower(seed.manufacturer_code);

delete from public.vehicle_manufacturer_segments s
using public.vehicle_manufacturers vm
where s.manufacturer_id = vm.id
  and vm.manufacturer_code in (select manufacturer_code from _vehicle_manufacturer_seed);

insert into public.vehicle_manufacturer_segments(manufacturer_id,segment_code)
select vm.id, trim(segment)
from _vehicle_manufacturer_seed seed
join public.vehicle_manufacturers vm on vm.manufacturer_code = seed.manufacturer_code
cross join lateral unnest(string_to_array(seed.segments,'|')) as segment;

delete from public.vehicle_manufacturer_brands b
using public.vehicle_manufacturers vm
where b.manufacturer_id = vm.id
  and vm.manufacturer_code in (select manufacturer_code from _vehicle_manufacturer_seed);

insert into public.vehicle_manufacturer_brands(manufacturer_id,brand_name,slug,logo_path,is_primary,is_active)
select
  vm.id,
  trim(brand),
  regexp_replace(regexp_replace(lower(trim(brand)), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'),
  case
    when seed.logo_path is not null and lower(trim(brand)) in (
      'ashok leyland','honda','hyundai','kia','mahindra','mahindra tractors','mahindra electric',
      'maruti suzuki','maruti','tata','toyota'
    ) then seed.logo_path
    else null
  end,
  ordinality = 1,
  true
from _vehicle_manufacturer_seed seed
join public.vehicle_manufacturers vm on vm.manufacturer_code = seed.manufacturer_code
cross join lateral unnest(string_to_array(seed.brands,'|')) with ordinality as b(brand, ordinality)
on conflict (manufacturer_id, (lower(brand_name))) do nothing;

delete from public.vehicle_manufacturer_aliases a
using public.vehicle_manufacturers vm
where a.manufacturer_id = vm.id
  and vm.manufacturer_code in (select manufacturer_code from _vehicle_manufacturer_seed);

insert into public.vehicle_manufacturer_aliases(manufacturer_id,alias,source,is_active)
select vm.id, alias, 'canonical-seed', true
from (
  select seed.manufacturer_code, seed.display_name as alias from _vehicle_manufacturer_seed seed
  union all select 'OEM-ASHOK-LEYLAND','Ashok Leyland'
  union all select 'OEM-HONDA-CARS','Honda'
  union all select 'OEM-HYUNDAI','Hyundai'
  union all select 'OEM-KIA','Kia'
  union all select 'OEM-MAHINDRA','Mahindra'
  union all select 'OEM-MAHINDRA','M&M'
  union all select 'OEM-MARUTI-SUZUKI','Maruti Suzuki'
  union all select 'OEM-MARUTI-SUZUKI','Maruti'
  union all select 'OEM-TATA-MOTORS','Tata Motors'
  union all select 'OEM-TATA-MOTORS','Tata'
  union all select 'OEM-TOYOTA','Toyota'
  union all select 'OEM-DICV','Bharat Benz'
  union all select 'OEM-DICV','BharatBenz'
  union all select 'OEM-EICHER-MOTORS','Royal Enfield'
  union all select 'OEM-INTERNATIONAL-TRACTORS','Sonalika'
  union all select 'OEM-NEW-HOLLAND','New Holland'
  union all select 'OEM-SML-MAHINDRA','SML Isuzu'
  union all select 'OEM-SML-MAHINDRA','SML Mahindra'
) aliases
join public.vehicle_manufacturers vm on vm.manufacturer_code = aliases.manufacturer_code
where nullif(trim(alias),'') is not null
on conflict (manufacturer_id, (lower(alias))) do nothing;

create or replace function public.save_vehicle_manufacturer_master(
  p_id uuid,
  p_payload jsonb,
  p_segments text[],
  p_brands text[],
  p_aliases text[],
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_name text := nullif(trim(p_payload->>'name'),'');
  v_display_name text := nullif(trim(p_payload->>'display_name'),'');
  v_code text := nullif(trim(p_payload->>'manufacturer_code'),'');
  v_slug text := nullif(trim(p_payload->>'slug'),'');
  v_logo_path text := nullif(trim(p_payload->>'logo_path'),'');
begin
  if v_name is null or v_display_name is null or v_code is null or v_slug is null then
    raise exception 'Legal name, display name, manufacturer code and slug are required.';
  end if;

  if v_logo_path is not null and v_logo_path not in (
    '/assets/vehicle-brands/ashok-leyland.svg',
    '/assets/vehicle-brands/honda.svg',
    '/assets/vehicle-brands/hyundai.svg',
    '/assets/vehicle-brands/kia.svg',
    '/assets/vehicle-brands/mahindra.svg',
    '/assets/vehicle-brands/maruti-suzuki.svg',
    '/assets/vehicle-brands/tata.svg',
    '/assets/vehicle-brands/toyota.svg'
  ) then
    raise exception 'Logo path is not in the verified local asset allowlist.';
  end if;

  if p_id is null then
    insert into public.vehicle_manufacturers(
      manufacturer_code,name,display_name,slug,parent_group_name,country_of_origin,india_presence_type,
      website_url,market_status,logo_path,logo_source_url,logo_status,source_name,source_url,
      source_verified_at,is_active,sort_order,created_by,updated_by
    ) values (
      v_code,v_name,v_display_name,v_slug,
      nullif(trim(p_payload->>'parent_group_name'),''),
      nullif(trim(p_payload->>'country_of_origin'),''),
      nullif(trim(p_payload->>'india_presence_type'),''),
      nullif(trim(p_payload->>'website_url'),''),
      coalesce(nullif(trim(p_payload->>'market_status'),''),'pending_review'),
      v_logo_path,
      nullif(trim(p_payload->>'logo_source_url'),''),
      case when v_logo_path is null then coalesce(nullif(trim(p_payload->>'logo_status'),''),'missing') else 'verified' end,
      nullif(trim(p_payload->>'source_name'),''),
      nullif(trim(p_payload->>'source_url'),''),
      case when nullif(trim(p_payload->>'source_verified_at'),'') is null then null else (p_payload->>'source_verified_at')::timestamptz end,
      coalesce((p_payload->>'is_active')::boolean,true),
      coalesce((p_payload->>'sort_order')::integer,1000),
      p_actor,p_actor
    ) returning id into v_id;
  else
    update public.vehicle_manufacturers
    set manufacturer_code=v_code,
        name=v_name,
        display_name=v_display_name,
        slug=v_slug,
        parent_group_name=nullif(trim(p_payload->>'parent_group_name'),''),
        country_of_origin=nullif(trim(p_payload->>'country_of_origin'),''),
        india_presence_type=nullif(trim(p_payload->>'india_presence_type'),''),
        website_url=nullif(trim(p_payload->>'website_url'),''),
        market_status=coalesce(nullif(trim(p_payload->>'market_status'),''),'pending_review'),
        logo_path=v_logo_path,
        logo_source_url=nullif(trim(p_payload->>'logo_source_url'),''),
        logo_status=case when v_logo_path is null then coalesce(nullif(trim(p_payload->>'logo_status'),''),'missing') else 'verified' end,
        source_name=nullif(trim(p_payload->>'source_name'),''),
        source_url=nullif(trim(p_payload->>'source_url'),''),
        source_verified_at=case when nullif(trim(p_payload->>'source_verified_at'),'') is null then null else (p_payload->>'source_verified_at')::timestamptz end,
        is_active=coalesce((p_payload->>'is_active')::boolean,true),
        sort_order=coalesce((p_payload->>'sort_order')::integer,sort_order),
        updated_by=p_actor
    where id=p_id
    returning id into v_id;
    if v_id is null then raise exception 'Vehicle manufacturer not found.'; end if;
  end if;

  delete from public.vehicle_manufacturer_segments where manufacturer_id=v_id;
  insert into public.vehicle_manufacturer_segments(manufacturer_id,segment_code)
  select v_id, trim(value)
  from unnest(coalesce(p_segments,array[]::text[])) value
  where nullif(trim(value),'') is not null
  on conflict do nothing;

  delete from public.vehicle_manufacturer_brands where manufacturer_id=v_id;
  insert into public.vehicle_manufacturer_brands(manufacturer_id,brand_name,slug,is_primary,is_active)
  select v_id, trim(value),
         regexp_replace(regexp_replace(lower(trim(value)), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'),
         ordinality=1,true
  from unnest(coalesce(p_brands,array[]::text[])) with ordinality as b(value,ordinality)
  where nullif(trim(value),'') is not null
  on conflict (manufacturer_id, (lower(brand_name))) do nothing;

  delete from public.vehicle_manufacturer_aliases where manufacturer_id=v_id;
  insert into public.vehicle_manufacturer_aliases(manufacturer_id,alias,source,is_active)
  select v_id, trim(value),'admin',true
  from unnest(coalesce(p_aliases,array[]::text[])) value
  where nullif(trim(value),'') is not null
  on conflict (manufacturer_id, (lower(alias))) do nothing;

  return v_id;
end;
$$;

revoke all on function public.save_vehicle_manufacturer_master(uuid,jsonb,text[],text[],text[],uuid) from public, anon, authenticated;
grant execute on function public.save_vehicle_manufacturer_master(uuid,jsonb,text[],text[],text[],uuid) to service_role;

commit;
