-- Representative, unapproved editorial samples only. No assessors, offers,
-- payments, player achievements or published coaching standards are seeded.
begin;
insert into public.pp_pathways(id,title) values ('beginner','Beginner'),('improver','Improver'),('intermediate','Intermediate'),('advanced','Advanced');
insert into public.pp_skills(id,pathway_id,title) values
 ('beginner-rally','beginner','Build a rally'),('improver-bandeja','improver','Bandeja');
insert into public.pp_standards(id,skill_id,version,criteria,evidence_requirements) values
 ('a0000000-0000-4000-8000-000000000001','beginner-rally',1,
  '[{"id":"control","expectation":"Draft: demonstrate controlled and repeatable contact."}]',
  '{"camera":"Draft: show the player and contact clearly.","repetitions":"Draft: representative rally repetitions; coach approval required.","max_seconds":90}'),
 ('a0000000-0000-4000-8000-000000000002','improver-bandeja',1,
  '[{"id":"position","expectation":"Draft: prepare early and remain balanced."},{"id":"contact","expectation":"Draft: use controlled and repeatable contact."}]',
  '{"camera":"Draft: show full body, ball contact and recovery.","repetitions":"Draft: multiple representative bandejas; rubric approval required.","max_seconds":90}');
insert into public.pp_lessons(id,standard_id,slug,title,practice_task,position) values
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','rally-contact','Find your contact point','Draft practice: gentle partner rallies with reflection on balanced contact.',1),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','bandeja-position','Read the lob. Find your position.','Draft practice: move behind gentle partner lobs and check balance.',1),
 ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','bandeja-contact','Choose control over power','Draft practice: controlled bandejas towards a broad target.',2);
insert into public.pp_policies(id,version,terms,commission_bps) values
 ('c0000000-0000-4000-8000-000000000001',1,
  'DRAFT PROPOSAL ONLY. Free pilot Passport. Coach-set paid assessment price. Proposed 20% gross commission, rounded half up to currency minor units. Both Developing and Verified deliver the assessment. Technical retries and unassessable footage replacements remain free on the same order. Reassessment is a new paid order. Commercial, tax, safeguarding, refund and retention approval is required before publication.',2000);
commit;
