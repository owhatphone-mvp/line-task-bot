require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { TaskDB, queryAll, queryOne } = require('./database');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// LINE SDK Configuration
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

// ─── OpenAI ChatGPT Setup ───
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AI_SYSTEM_PROMPT = `คุณชื่อ "อู่อันโหว" เป็น AI ผู้ช่วยอัจฉริยะประจำกลุ่ม LINE
คุณเป็นผู้ชาย พูดจาแบบผู้ชายเสมอ ใช้ครับ/นะครับ/ครับผม ห้ามใช้ค่ะ/คะ/นะคะ เด็ดขาด

=== ตัวตนของคุณ ===
คุณเป็น AI ที่รอบรู้ทุกเรื่องเหมือน ChatGPT เต็มรูปแบบ ไม่ได้จำกัดแค่เรื่องงาน
คุณสามารถตอบได้ทุกหัวข้อ ทุกศาสตร์ ทุกสาขา ไม่ว่าจะเป็น:
- วิทยาศาสตร์ เทคโนโลยี คณิตศาสตร์ วิศวกรรม (STEM)
- ประวัติศาสตร์ ภูมิศาสตร์ การเมือง สังคม วัฒนธรรม
- ธุรกิจ การเงิน การลงทุน เศรษฐศาสตร์ การตลาด
- สุขภาพ การแพทย์ โภชนาการ ออกกำลังกาย
- กฎหมาย ภาษี ประกัน สิทธิผู้บริโภค
- ภาษา การเขียน การแปล ไวยากรณ์
- ศิลปะ ดนตรี ภาพยนตร์ วรรณกรรม บันเทิง
- อาหาร สูตรอาหาร ร้านอาหาร ท่องเที่ยว
- การศึกษา เด็ก ครอบครัว จิตวิทยา
- เกม กีฬา ดารา ข่าวสาร เทรนด์
- เขียนโค้ด พัฒนาซอฟต์แวร์ AI/ML ฐานข้อมูล
- ปรัชญา ศาสนา จริยธรรม การใช้ชีวิต
- และทุกเรื่องอื่นๆ ที่ถามมา

คุณตอบคำถามทั่วไปได้เต็มที่ พร้อมกับมีความเชี่ยวชาญพิเศษด้านจัดการงาน จัดงาน Event และวางแผนธุรกิจ

=== ข้อมูลบริษัท MVP (กลุ่มของเรา) ===
กลุ่มแชทนี้เป็นกลุ่มของบริษัท เอ็ม วิชั่น จำกัด (มหาชน) หรือ "MVP"
คุณเป็นบอทประจำบริษัทนี้ ให้ตอบในฐานะคนในทีม MVP

ข้อมูลบริษัท:
- ชื่อ: บริษัท เอ็ม วิชั่น จำกัด (มหาชน) / M Vision Public Company Limited
- ชื่อย่อในตลาดหลักทรัพย์: MVP (ตลาด mai)
- ประเภท: ผู้เชี่ยวชาญด้านการจัดงานอีเว้นท์ (Event Organizer) ระดับมืออาชีพ มากกว่า 12 ปี
- ที่อยู่: เลขที่ 11/1 ซอยรามคำแหง 121 กรุงเทพฯ
- เว็บไซต์: https://www.mvisioncorp.com
- วิสัยทัศน์: "ผู้นำด้านการพัฒนาแพลตฟอร์มเพื่อการขายประสบการณ์แนวใหม่ ทั้งที่พัก การเดินทางและกิจกรรม"
- พันธกิจ: มุ่งมั่นพัฒนาเพื่อยกระดับความเป็น "แพลตฟอร์มศูนย์รวมประสบการณ์"

ผู้บริหารและคณะกรรมการ:
- ประธานกรรมการบริษัท / กรรมการอิสระ: นายทนง ลี้อิสสระนุกูล
- ประธานคณะกรรมการบริหาร (CEO): นายโอภาส เฉิดพันธุ์
- กรรมการบริษัท: นายธราธร ยวงบัณฑิต
- กรรมการบริษัท: นายธีรวัฒน์ สุวรรณพินิจ
- กรรมการบริษัท: นางสาวประพิมพรรณ เลิศสิริสิน
- ประธานกรรมการตรวจสอบ / กรรมการอิสระ: ดร. ณัฐกฤษฎ์ ทิวไผ่งาม
- กรรมการตรวจสอบ / กรรมการอิสระ: นายสัณหะ เหมวนิช
- กรรมการตรวจสอบ / กรรมการอิสระ: นายคงพันธุ์ ปราโมชฯ
- กรรมการอิสระ: นายปรีชาวุฒิ กี่สิ้น

กลุ่มธุรกิจหลัก 3 กลุ่ม:
1. Event & Technology — จัดงานแสดงสินค้า นิทรรศการ สัมมนาวิชาการ เทคโนโลยี
2. Media & Agency — สื่อออฟไลน์/ออนไลน์ ดิจิตอลเอเจนซี่ ประชาสัมพันธ์
3. Commerce — พาณิชย์อิเล็กทรอนิกส์ พัฒนาแอปพลิเคชัน

ธุรกิจย่อย 5 ด้าน:
1. ธุรกิจสื่อออฟไลน์และออนไลน์
2. ธุรกิจจัดงานแสดงสินค้า งานนิทรรศการ งานสัมมนาทางวิชาการ
3. ธุรกิจดิจิตอลเอเจนซี่
4. ธุรกิจพัฒนาแอปพลิเคชัน (Android, iOS)
5. ธุรกิจพาณิชย์อิเล็กทรอนิกส์ (e-commerce)

บริษัทย่อย:
- บริษัท ไอดอลมาสเตอร์ จำกัด (76%) — ให้คำปรึกษาด้านการสื่อสารประชาสัมพันธ์
- บริษัท ไอเดียล บล๊อคเชน อีเว้นท์ ออกาไนเซอร์ จำกัด (50%) — ขายและให้บริการด้านเทคโนโลยีสารสนเทศ
- บริษัท เอ็มอาร์ คอนเน็กซ์ จำกัด (40% บริษัทร่วม) — จัดแข่งขันกีฬาแบบครบวงจร

งานที่ MVP จัดเป็นประจำ (ผลงานเด่น):
🔥 Thailand Mobile Expo — มหกรรมโทรศัพท์มือถือที่ใหญ่ที่สุดอันดับ 1 ของประเทศไทย จัดมาแล้ว 40+ ครั้ง
🔥 Bangkok EV Expo — งานแสดงรถยนต์ไฟฟ้า (จัดมาแล้ว 5+ ครั้ง)
🔥 Thailand Boat Expo — มหกรรมเรือและกิจกรรมทางน้ำ
🔥 AI Expo Thailand — งาน AI ที่ใหญ่ที่สุดในไทย (ครั้งแรก 2026)
🏃 งานวิ่ง: Samsung Galaxy 10K, จอมบึงมาราธอน, เขาประทับช้างเทรล
🚐 MV Caravan — ธุรกิจเช่ารถบ้าน (มีจำนวนรถบ้านมากที่สุดในประเทศไทย)

MVP Chain (เทคโนโลยีใหม่):
- บล็อกเชนระดับ Layer 3 พัฒนาโดย MVP บน World Chain (Ethereum Layer 3)
- เชื่อมโยงกิจกรรมในชีวิตจริงเข้ากับโลกดิจิทัล
- ครอบคลุม: Event, Marketplace, Digital Identity (World ID), Reward Ecosystem
- ใช้ MVP Token เป็นค่า Gas
- เป็นพันธมิตรหลักของ World ID ในประเทศไทย (บริการยืนยันตัวตนดิจิทัล)

เมื่อมีคนถามเกี่ยวกับ MVP หรือบริษัท ให้ตอบจากข้อมูลนี้อย่างภาคภูมิใจในฐานะทีม MVP
ถ้าถามรายละเอียดที่ไม่มี ให้แนะนำดูที่ mvisioncorp.com

=== ระบบจัดการงาน (Task System) ===
คุณเป็นบอทที่มีระบบจัดการงานในตัว คำสั่งทั้งหมดใช้ # นำหน้า:

📌 สั่งงาน:
- #สั่งงาน @ชื่อคน รายละเอียดงาน → สร้างงานใหม่ ระบบจะสร้างรหัสงาน 6 ตัว เช่น AB12CD
- ตัวอย่าง: #สั่งงาน @สมชาย ช่วยทำรายงานสรุปยอดขาย

👍 รับงาน:
- #รับงาน → รับงานล่าสุดที่ได้รับมอบหมาย
- #รับงาน <รหัสงาน> <กำหนดส่ง> → รับงานพร้อมระบุ deadline
- ตัวอย่าง: #รับงาน AB12CD พรุ่งนี้ 12:00
- รูปแบบเวลา: วันนี้ 18:00, พรุ่งนี้ 12:00, 15/04 09:00, 15/04/2026 09:00

✅ ส่งงาน:
- #ส่งงาน <รหัสงาน> <ข้อความ> → ส่งงานพร้อมรายงานผล
- ตัวอย่าง: #ส่งงาน AB12CD เสร็จแล้วครับ แนบไฟล์ในอีเมล

📋 ดูงาน:
- #งานที่ต้องทำ → ดูงานทั้งหมดของตัวเอง
- #งานค้าง → ดูเฉพาะงานที่ยังไม่เสร็จ
- #สรุปงาน → สรุปงานทั้งหมดในกลุ่มแยกรายวัน
- #สรุปแชท → สรุปการพูดคุยในกลุ่มแยกรายวัน
- #help → แสดงคู่มือทั้งหมด

⏰ ระบบทวงงานอัตโนมัติ:
- เมื่อรับงานต้องระบุ deadline
- ถ้าเลย deadline แล้วยังไม่ส่งงาน บอทจะทวงอัตโนมัติทุก 5 นาที

💎 ระบบแต้มสะสม:
- รับภารกิจ: +5 แต้ม
- ส่งงานเสร็จก่อนกำหนด: +15 แต้ม
- ส่งงานตรงเวลา: +10 แต้ม
- ส่งงานเลยกำหนด: +5 แต้ม
- มีระบบ Streak (ทำเสร็จติดต่อกัน)
- คำสั่ง: #แต้ม (ดูแต้มตัวเอง), #อันดับ (ดูลีดเดอร์บอร์ด)

สถานะงาน: pending (รอรับ) → accepted (รับแล้ว) → submitted (รอตรวจ) → completed (เสร็จ)
- ผู้สั่งงานต้องอนุมัติงานก่อนถึงจะเสร็จ
- ถ้างานต้องแก้ไข ผู้สั่งงานส่งกลับได้ (กลับเป็น accepted)

=== ระบบ DM ===
- สั่งงาน (#สั่งงาน) → ใช้ในกลุ่มเท่านั้น
- รับงาน/ส่งงาน (#รับงาน, #ส่งงาน) → ใช้ใน DM ส่วนตัว (หรือในกลุ่มก็ได้)
- อนุมัติ/แก้ไข (#อนุมัติ, #แก้ไข) → ใช้ใน DM ส่วนตัว
- ผู้ใช้ต้องเพิ่มบอทเป็นเพื่อนก่อนจึงจะได้รับ DM
- ลิงก์เพิ่มเพื่อน: https://line.me/R/ti/p/@909kiqvu

=== บทบาทของคุณ ===
- ช่วยวางแผนงาน จัดลำดับความสำคัญ แนะนำขั้นตอน
- สรุปการประชุม สรุปเนื้อหา ช่วยเขียนข้อความ
- ตอบคำถามเรื่องงาน ช่วยคิด ช่วยตัดสินใจ
- ถ้ามีคนถามวิธีใช้งานบอท ให้แนะนำคำสั่งที่เกี่ยวข้อง
- ถ้ามีบริบทงานค้างหรือแชทก่อนหน้า ให้ใช้ข้อมูลนั้นประกอบการตอบ
- ถ้ามีคนบอกว่าจะทำอะไร ให้แนะนำให้ใช้ #สั่งงาน เพื่อติดตามงานได้

=== สกิลที่ปรึกษา ===
คุณมีความเชี่ยวชาญพิเศษในด้านต่อไปนี้ สามารถให้คำปรึกษาเชิงลึกได้:

🏢 ที่ปรึกษาการบริหารงาน (Work Management Consultant):
- การวางโครงสร้างทีม แบ่งบทบาทหน้าที่ ออกแบบ workflow
- การจัดลำดับความสำคัญงาน (Eisenhower Matrix, MoSCoW, RICE Scoring)
- การติดตามงาน ตั้ง KPI/OKR วัดผลลัพธ์
- การบริหารเวลา (Time Blocking, Pomodoro, Deep Work)
- การจัดการ bottleneck และ dependency ระหว่างงาน
- การสื่อสารในทีม การ delegate งานอย่างมีประสิทธิภาพ
- การจัดการความเสี่ยง (Risk Assessment, Mitigation Plan)
- Agile/Scrum/Kanban สำหรับทีมขนาดเล็ก-กลาง

🎪 ที่ปรึกษาการจัดงาน (Event Management Consultant):
- การวางแผนจัดงาน Expo, Conference, Meetup, Seminar, Workshop ครบวงจร
- การจัดทำ Timeline และ Checklist จัดงาน (ก่อนงาน, วันงาน, หลังงาน)
- การวาง Floor Plan, โซนนิ่ง, จัดผังบูธ, จัด Stage
- การบริหารงบประมาณจัดงาน, ประมาณการค่าใช้จ่าย
- การหาสปอนเซอร์, ออกแบบ Sponsorship Package
- การบริหารทีม Organizer, Staff, Volunteer
- การจัดการ Speaker, กำหนดการ, MC Script
- การทำ Marketing จัดงาน: โปรโมท, PR, Social Media Campaign
- การจัดการลงทะเบียน, ระบบ Check-in, Badge, QR Code
- การวัดผลงาน (Post-event Report, ROI, Feedback Survey)
- การจัดการ Logistics: AV, อาหาร, ที่จอดรถ, ป้าย, ของแจก

📋 ที่ปรึกษาการวางแผน (Strategic Planning Consultant):
- การวางแผนโปรเจค (Project Planning) ตั้งแต่ต้นจนจบ
- การทำ Gantt Chart, Work Breakdown Structure (WBS)
- การวางแผนการเงินและงบประมาณ
- การวิเคราะห์ SWOT, PESTLE, Porter's Five Forces
- การตั้งเป้าหมาย SMART Goals
- การวางแผน Go-to-Market Strategy
- การวางแผน Content Calendar, Marketing Plan
- การวางแผนรับมือวิกฤต (Contingency Planning)
- Business Model Canvas, Lean Canvas สำหรับ Startup
- การวางแผนขยายธุรกิจ, Scaling Strategy

📐 วิธีให้คำปรึกษา:
- ถามข้อมูลเพิ่มเติมก่อนให้คำแนะนำ (อย่าเดาเอง)
- ให้คำแนะนำที่ actionable ทำได้จริง ไม่ใช่แค่ทฤษฎี
- ถ้าเป็นเรื่องใหญ่ ให้แบ่งเป็นขั้นตอน step-by-step
- ใช้ Framework ที่เหมาะสมกับสถานการณ์
- ยกตัวอย่างจริงประกอบ ถ้าเป็นไปได้
- เตือนความเสี่ยงหรือจุดที่ต้องระวัง
- แนะนำให้ใช้ #สั่งงาน เพื่อติดตาม action items จากแผน

=== ข้อมูลงาน AI Expo Thailand 2026 ===
งานนี้จัดโดย บริษัท เอ็ม วิชั่น จำกัด (มหาชน) — ผู้จัดงาน Thailand Mobile Expo มากว่า 15 ปี

📅 วันที่: 1–4 ตุลาคม 2569 (October 2026)
⏰ เวลา: 10:00–19:00 น. ทุกวัน
📍 สถานที่: IMPACT Challenger เมืองทองธานี นนทบุรี
🅿️ ที่จอดรถ: ฟรี 10,000+ คัน
🌐 เว็บไซต์: https://aiexpothailand.com
📧 ติดต่อ: info@aiexpothailand.com

ขนาดงาน:
- พื้นที่ 17,136 ตร.ม. (153×112 เมตร)
- บูธ AI Exhibitors 300+
- ผู้เข้าชมงาน 10,000+
- Speakers ระดับ World-class 30+
- จัด 4 วัน

โซนภายในงาน:
1. AI Marketplace — 300+ บูธจากทุกเซ็กเมนต์ AI ทั้งไทยและต่างประเทศ
2. Main Stage — Keynote จากผู้นำ AI ระดับโลก และ Panel Discussions
3. Workshop Zone — Hands-on workshops สอนใช้ AI จริง ทำได้เลย
4. Startup Village — 50 AI Startups สุดล้ำ พร้อมโอกาสลงทุน
5. Generative AI Zone — สัมผัส ChatGPT, Claude, Gemini, Llama และ AI models ล่าสุดจากทุกค่าย พร้อมทดลองใช้จริง
6. AI for Industry — Manufacturing, Healthcare, Agriculture, Finance, Energy
7. AI Networking Lounge — พื้นที่เน็ตเวิร์คสำหรับ CEO, CTO, Developer, Investor
8. AI Awards Thailand — AI Innovation Awards สำหรับ Startup และองค์กรที่ใช้ AI โดดเด่น
9. Live Demo Arena — โซนสาธิต AI สดทุกวัน: Robotics, Computer Vision, NLP, Autonomous Systems
10. AI Career Fair — บริษัทชั้นนำ 50+ ที่กำลังรับ AI talent

หัวข้อที่ครอบคลุม: Generative AI, LLMs & Foundation Models, AI in Healthcare, AI for Finance, Robotics, Computer Vision, AI Ethics, AI Startups, Smart City, AI in Education, MLOps, Edge AI

ลงทะเบียนได้ที่: https://aiexpothailand.com/register
ประเภท: เข้าชมงาน (Visitor), ออกบูธ (Exhibitor), เป็น Speaker, AI Startup Village, สื่อมวลชน (Media)

=== ข้อมูลงาน AI Meetup Bangkok (Road to AI Expo Thailand) ===
จัดโดย เอ็ม วิชั่น เป็นซีรีส์ meetup 6 ครั้ง เพื่อวอร์มอัพก่อนงาน AI Expo Thailand 2026

กำหนดการ 6 ครั้ง:
1. เมษายน 2569 — หัวข้อ: AI Tools (เรียนรู้เครื่องมือ AI ยอดฮิต)
2. พฤษภาคม 2569 — หัวข้อ: AI x Business (AI กับภาคธุรกิจ)
3. มิถุนายน 2569 — หัวข้อ: Startup Showdown (โชว์สตาร์ทอัพ AI)
4. กรกฎาคม 2569 — หัวข้อ: Safety & Ethics (ความปลอดภัยและจริยธรรม AI)
5. สิงหาคม 2569 — หัวข้อ: Developer Deep Dive (เจาะลึกสำหรับนักพัฒนา)
6. กันยายน 2569 — หัวข้อ: Expo Preview Night (พรีวิวงาน Expo)

📍 สถานที่: สยามพารากอน กรุงเทพฯ
🌐 ลงทะเบียน: https://meetup.aiexpothailand.com
📧 สอบถาม: info@aiexpothailand.com

ถ้ามีคนถามเกี่ยวกับงาน AI Expo Thailand หรือ AI Meetup Bangkok ให้ตอบจากข้อมูลนี้ พร้อมแนะนำให้ลงทะเบียน
ถ้าถามรายละเอียดที่ไม่มีในข้อมูลนี้ (เช่น ราคาบัตร, รายชื่อ speakers เฉพาะ) ให้บอกว่ายังไม่ประกาศ แนะนำให้ติดตามที่ aiexpothailand.com

=== รูปแบบการตอบ ===
- ตอบสั้นๆ กระชับ เหมือนเพื่อนร่วมงานพิมพ์ตอบในแชท ไม่ใช่เขียนบทความ
- ห้ามตอบยาวเป็นท่อนๆ เหมือนก๊อปมาวาง ให้ตอบแบบคนคุยกันจริงๆ
- ประโยคสั้น 2-4 บรรทัดก็พอสำหรับคำถามทั่วไป ไม่ต้องอธิบายยืดยาว
- ถ้าเรื่องซับซ้อนจริงๆ ค่อยขยายเพิ่ม แต่ก็อย่าเกิน 500 ตัวอักษร
- เรื่องวางแผน/จัดงาน ตอบได้ยาวขึ้นหน่อย แต่สูงสุด 800 ตัวอักษร แบ่งเป็นข้อสั้นๆ
- ตอบเป็นภาษาไทยเสมอ ยกเว้นถูกถามเป็นภาษาอื่น
- ห้ามใช้หัวข้อใหญ่ ห้ามใช้ ** ตัวหนา ห้ามจัดฟอร์แมตเหมือนบทความ พิมพ์เหมือนแชทปกติ
- ใช้ emoji ได้บ้างนิดหน่อย แต่ไม่ต้องเยอะ

=== นิสัย/บุคลิก ===
- ห้ามตอบแล้วจบเฉยๆ เด็ดขาด ทุกครั้งที่ตอบต้องเสนอตัวช่วยต่อ
- จบทุกคำตอบด้วยการถามว่า "ให้ช่วยอะไรต่อไหมครับ?" หรือ "ผมทำตรงไหนต่อดีครับ?"
- เสนอ action ที่ทำได้จริง เช่น "ผมช่วยร่างแผนให้เลยไหมครับ?" "จะให้ผมสั่งงานแจกคนในทีมเลยไหม?"
- ถ้าเห็นว่างานไหนน่าจะต้องทำต่อ ให้แนะนำเลย อย่ารอให้ถาม
- พูดเหมือนเพื่อนร่วมงานที่กระตือรือร้น อยากช่วย ไม่ใช่หุ่นยนต์ที่รอคำสั่ง
- ถ้าคำถามเกี่ยวข้องกับงานในระบบ ให้อ้างอิงข้อมูลงานที่มีอยู่ด้วย
- ถ้าไม่แน่ใจคำตอบ ให้บอกตรงๆ ว่าไม่แน่ใจ อย่าแต่งขึ้นมา
- ตอบทุกเรื่องที่ถามมาได้ ไม่ต้องปฏิเสธว่า "ผมเป็นแค่บอท" คุณคือ AI เต็มรูปแบบ`;

console.log('🤖 OpenAI ChatGPT initialized (gpt-4o-mini)');

// LINE Webhook endpoint (must come BEFORE express.json to preserve raw body for signature validation)
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    
    for (const event of events) {
      await handleEvent(event);
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// จัดการ events จาก LINE
async function handleEvent(event) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // จัดการข้อความที่ส่งมา
  if (event.type === 'message' && event.message.type === 'text') {
    await handleTextMessage(event);
  }
  
  // จัดการเมื่อบอทถูกเชิญเข้ากลุ่ม
  if (event.type === 'join') {
    await handleJoinEvent(event);
  }
  
  // จัดการเมื่อมีสมาชิกเข้ากลุ่ม
  if (event.type === 'memberJoined') {
    await handleMemberJoined(event);
  }
}

// จัดการข้อความ text
async function handleTextMessage(event) {
  const { text } = event.message;
  const groupId = event.source.groupId || event.source.roomId || null;
  const userId = event.source.userId;
  
  // ถ้าเป็น DM (ไม่ใช่กลุ่ม) → จัดการแยก
  if (!groupId) {
    await handleDMMessage(event, userId, text);
    return;
  }

  // ดึงข้อมูลผู้ใช้
  const userProfile = await getUserProfile(groupId, userId);
  const displayName = userProfile?.displayName || 'ไม่ระบุชื่อ';

  // บันทึกสมาชิก
  await TaskDB.saveMember(groupId, userId, displayName);

  // บันทึกทุกข้อความลง chat_logs (ยกเว้นคำสั่งบอท)
  if (!text.startsWith('#')) {
    await TaskDB.saveChatLog(groupId, userId, displayName, text);
  }

  // คำสั่งช่วยเหลือ
  if (text === '#help' || text === '#h' || text === '#ช่วย') {
    await sendHelpMessage(event.replyToken);
    return;
  }

  // ดูงานทั้งหมดของฉัน
  if (text === '#งานที่ต้องทำ' || text === '#mytasks' || text === '#mytask') {
    await showMyTasks(event.replyToken, groupId, userId);
    return;
  }

  // ดูงานที่ยังไม่เสร็จ
  if (text === '#งานค้าง' || text === '#pending') {
    await showPendingTasks(event.replyToken, groupId, userId);
    return;
  }

  // สรุปงานทั้งหมดแยกรายวัน
  if (text === '#สรุปงาน' || text === '#summary') {
    await showDailySummary(event.replyToken, groupId);
    return;
  }

  // สรุปการพูดคุยในกลุ่มแยกรายวัน
  if (text === '#สรุปแชท' || text === '#chatlog') {
    await showChatSummary(event.replyToken, groupId);
    return;
  }

  // ดูแต้มของตัวเอง
  if (text === '#แต้ม' || text === '#คะแนน' || text === '#points') {
    await showMyPoints(event.replyToken, groupId, userId, displayName);
    return;
  }

  // ดูอันดับในกลุ่ม
  if (text === '#อันดับ' || text === '#ranking' || text === '#leaderboard') {
    await showLeaderboard(event.replyToken, groupId);
    return;
  }

  // ส่งงาน/ตอบกลับงาน (รูปแบบ: #ส่งงาน <รหัสงาน> <ข้อความ>)
  if (text.startsWith('#ส่งงาน ') || text.startsWith('#done ')) {
    await handleTaskReply(event.replyToken, groupId, userId, displayName, text);
    return;
  }

  // รับงาน (รูปแบบ: #รับงาน หรือ #รับงาน <รหัสงาน>)
  if (text === '#รับงาน' || text.startsWith('#รับงาน ')) {
    await handleAcceptTask(event.replyToken, groupId, userId, displayName, text);
    return;
  }

  // ─── AI Chat: ตอบเมื่อถูก @mention ───
async function handleAIChat(event, groupId, userId, displayName, text, mentionees) {
  // ลบ @mention ออกจากข้อความ เหลือแต่คำถาม
  let question = text;
  for (const m of mentionees) {
    if (m.isSelf) {
      const mentionText = text.substring(m.index, m.index + m.length);
      question = question.replace(mentionText, '').trim();
    }
  }

  if (!question) {
    await replyMessage(event.replyToken, 'สวัสดีครับ! มีอะไรให้ช่วยไหม? พิมพ์ข้อความตามหลัง @บอท ได้เลยครับ 😊');
    return;
  }

  try {
    // ดึงแชทล่าสุด 20 ข้อความ เป็นบริบท
    const recentLogs = await TaskDB.getRecentChatLogs(groupId, 20);
    
    // ดึงงานที่ยังไม่เสร็จ เป็นบริบทงาน
    const pendingTasks = await TaskDB.getAllPendingTasksInGroup(groupId);

    // สร้าง context
    let context = '';
    
    if (recentLogs.length > 0) {
      context += '=== แชทล่าสุดในกลุ่ม ===\n';
      for (const log of recentLogs) {
        const time = new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        context += `[${time}] ${log.display_name}: ${log.message}\n`;
      }
      context += '\n';
    }

    if (pendingTasks.length > 0) {
      context += '=== งานที่ยังไม่เสร็จ ===\n';
      for (const task of pendingTasks) {
        const status = task.status === 'accepted' ? 'รับแล้ว' : 'รอรับ';
        context += `- [${task.task_id}] ${task.message} → ${task.assignee_name} (${status})`;
        if (task.deadline) {
          context += ` กำหนด: ${formatDeadline(task.deadline)}`;
        }
        context += '\n';
      }
      context += '\n';
    }

    const fullPrompt = context 
      ? `บริบท:\n${context}\nคำถามจาก ${displayName}:\n${question}`
      : `คำถามจาก ${displayName}:\n${question}`;

    console.log(`🤖 AI request from ${displayName}: ${question}`);

    // เรียก OpenAI ChatGPT
    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: fullPrompt }
      ],
      max_tokens: 800
    });
    let aiResponse = result.choices[0].message.content;

    // ตัดให้ไม่เกิน LINE limit
    if (aiResponse.length > 4500) {
      aiResponse = aiResponse.substring(0, 4500) + '\n\n...(ข้อความยาวเกิน ตัดบางส่วน)';
    }

    console.log(`🤖 AI response: ${aiResponse.substring(0, 100)}...`);

    await replyMessage(event.replyToken, aiResponse);

  } catch (err) {
    console.error('AI Error:', err);
    
    if (err.message?.includes('API_KEY') || err.message?.includes('Incorrect API key')) {
      await replyMessage(event.replyToken, '❌ API Key ไม่ถูกต้องครับ');
    } else if (err.message?.includes('quota') || err.message?.includes('Rate limit') || err.status === 429) {
      await replyMessage(event.replyToken, '⏳ ใช้ AI บ่อยเกินไปครับ รอสักครู่แล้วลองใหม่');
    } else if (err.message?.includes('insufficient_quota')) {
      await replyMessage(event.replyToken, '❌ เครดิต OpenAI หมดครับ กรุณาเติมเงิน');
    } else {
      await replyMessage(event.replyToken, '❌ AI ขัดข้อง กรุณาลองใหม่ครับ');
    }
  }
}

// สร้างงานใหม่ (รูปแบบ: #สั่งงาน @ชื่อคน รายละเอียดงาน)
  const mentionees = event.message.mention?.mentionees || [];
  
  if (text.startsWith('#สั่งงาน') && mentionees.length > 0) {
    await createTask(event, mentionees, displayName);
    return;
  }

  // ─── AI ตอบเมื่อถูก @mention ───
  const botMentioned = mentionees.some(m => m.isSelf === true);
  if (botMentioned) {
    await handleAIChat(event, groupId, userId, displayName, text, mentionees);
    return;
  }
}

// ═══════════════════════════════════════════
// ═══ จัดการข้อความใน DM (1-on-1 chat) ═══
// ═══════════════════════════════════════════
async function handleDMMessage(event, userId, text) {
  const profile = await getUserProfileDM(userId);
  const displayName = profile?.displayName || 'ไม่ระบุชื่อ';

  // รับงานใน DM
  if (text === '#รับงาน' || text.startsWith('#รับงาน ')) {
    await handleAcceptTaskDM(event.replyToken, userId, displayName, text);
    return;
  }

  // ส่งงานใน DM
  if (text.startsWith('#ส่งงาน ') || text.startsWith('#done ')) {
    await handleTaskReplyDM(event.replyToken, userId, displayName, text);
    return;
  }

  // อนุมัติงาน
  if (text.startsWith('#อนุมัติ ') || text.startsWith('#approve ')) {
    await handleApproveTask(event.replyToken, userId, displayName, text);
    return;
  }

  // แก้ไข/ส่งกลับงาน
  if (text.startsWith('#แก้ไข ') || text.startsWith('#reject ')) {
    await handleRejectTask(event.replyToken, userId, displayName, text);
    return;
  }

  // งานที่ต้องทำ (ดูได้ใน DM)
  if (text === '#งานที่ต้องทำ' || text === '#mytasks' || text === '#mytask') {
    await showMyTasksDM(event.replyToken, userId);
    return;
  }

  // งานค้าง
  if (text === '#งานค้าง' || text === '#pending') {
    await showPendingTasksDM(event.replyToken, userId);
    return;
  }

  // help
  if (text === '#help' || text === '#h' || text === '#ช่วย') {
    await sendDMHelpMessage(event.replyToken);
    return;
  }

  // ข้อความอื่นๆ ใน DM → AI ตอบ
  try {
    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT + '\n\nตอนนี้คุยกันใน DM ส่วนตัว ไม่ใช่ในกลุ่ม' },
        { role: 'user', content: `คำถามจาก ${displayName}:\n${text}` }
      ],
      max_tokens: 800
    });
    let aiResponse = result.choices[0].message.content;
    if (aiResponse.length > 4500) aiResponse = aiResponse.substring(0, 4500) + '\n\n...(ตัดบางส่วน)';
    await replyMessage(event.replyToken, aiResponse);
  } catch (err) {
    console.error('AI Error in DM:', err);
    await replyMessage(event.replyToken,
      `สวัสดีครับ! 👋 ผม อู่อันโหว\n\n` +
      `ใน DM ผมช่วยจัดการงานได้ครับ:\n` +
      `• #รับงาน <รหัส> <กำหนดส่ง>\n` +
      `• #ส่งงาน <รหัส> <ข้อความ>\n` +
      `• #อนุมัติ <รหัส>\n` +
      `• #แก้ไข <รหัส> <เหตุผล>\n` +
      `• #งานที่ต้องทำ\n` +
      `• #help`
    );
  }
}

// ── DM: รับงาน ──
async function handleAcceptTaskDM(replyToken, userId, displayName, text) {
  const parts = text.replace('#รับงาน', '').trim().split(/\s+/);

  let taskId = null;
  let deadlineText = '';

  if (parts.length > 0 && parts[0].match(/^[A-Z0-9]{6}$/)) {
    taskId = parts[0];
    deadlineText = parts.slice(1).join(' ');
  } else {
    deadlineText = parts.join(' ');
  }

  // หางาน
  let task;
  if (taskId) {
    task = await TaskDB.getTaskById(taskId);
  } else {
    const pendingTasks = await TaskDB.getTasksByUserId(userId, 'pending');
    task = pendingTasks.length > 0 ? pendingTasks[0] : null;
  }

  if (!task) {
    await replyMessage(replyToken, 'ไม่พบงานที่รอรับครับ');
    return;
  }

  if (task.assignee_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้รับผิดชอบงานรหัส ${task.task_id} ครับ`);
    return;
  }

  if (task.status === 'accepted') {
    await replyMessage(replyToken, `คุณรับงานรหัส ${task.task_id} ไปแล้วครับ`);
    return;
  }

  if (task.status === 'completed') {
    await replyMessage(replyToken, `งานรหัส ${task.task_id} เสร็จสิ้นไปแล้วครับ`);
    return;
  }

  // ต้องระบุกำหนดส่ง
  if (!deadlineText) {
    try {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `📅 กรุณาระบุกำหนดส่งด้วยครับ\n\nพิมพ์: #รับงาน ${task.task_id} <กำหนดส่ง>\n\nตัวอย่าง:\n• #รับงาน ${task.task_id} วันนี้ 18:00\n• #รับงาน ${task.task_id} พรุ่งนี้ 12:00\n• #รับงาน ${task.task_id} 15/04 09:00`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '⏰ วันนี้ 18:00', text: `#รับงาน ${task.task_id} วันนี้ 18:00` } },
              { type: 'action', action: { type: 'message', label: '📅 พรุ่งนี้ 12:00', text: `#รับงาน ${task.task_id} พรุ่งนี้ 12:00` } },
              { type: 'action', action: { type: 'message', label: '📅 พรุ่งนี้ 18:00', text: `#รับงาน ${task.task_id} พรุ่งนี้ 18:00` } }
            ]
          }
        }]
      });
    } catch (err) {
      await replyMessage(replyToken, `📅 กรุณาระบุกำหนดส่งด้วยครับ\n\nพิมพ์: #รับงาน ${task.task_id} <กำหนดส่ง>\nตัวอย่าง: #รับงาน ${task.task_id} พรุ่งนี้ 12:00`);
    }
    return;
  }

  const deadline = parseDeadline(deadlineText);
  if (!deadline) {
    await replyMessage(replyToken, `❌ รูปแบบวันที่ไม่ถูกต้อง\n\nตัวอย่าง:\n• วันนี้ 18:00\n• พรุ่งนี้ 12:00\n• 15/04 09:00`);
    return;
  }

  // บันทึก
  await TaskDB.acceptTask(task.task_id, deadline.toISOString());

  // ให้แต้ม +5
  const ACCEPT_POINTS = 5;
  await TaskDB.addPoints(task.group_id, userId, displayName, ACCEPT_POINTS, task.task_id, 'รับภารกิจ');
  const currentPoints = await TaskDB.getPoints(task.group_id, userId);
  const totalPts = currentPoints ? currentPoints.total_points : ACCEPT_POINTS;

  // ตอบกลับใน DM
  const flexMsg = buildFlexTaskAccepted(task.task_id, task.assigner_name, displayName, task.message, formatDeadline(deadline), ACCEPT_POINTS, totalPts);
  try {
    await client.replyMessage({ replyToken, messages: [flexMsg] });
  } catch (err) {
    await replyMessage(replyToken, `👍 รับงานแล้ว!\nรหัส: ${task.task_id}\nกำหนดส่ง: ${formatDeadline(deadline)}`);
  }

  // แจ้งเตือนสั้นๆ ในกลุ่ม
  try {
    await client.pushMessage({
      to: task.group_id,
      messages: [{
        type: 'textV2',
        text: `👍 {assignee} รับงานรหัส ${task.task_id} แล้ว!\n⏰ กำหนดส่ง: ${formatDeadline(deadline)} {assigner}`,
        substitution: {
          assignee: { type: 'mention', mentionee: { type: 'user', userId: userId } },
          assigner: { type: 'mention', mentionee: { type: 'user', userId: task.assigner_id } }
        }
      }]
    });
  } catch (err) {
    console.log('Could not notify group:', err.message);
  }
}

// ── DM: ส่งงาน (submit for review) ──
async function handleTaskReplyDM(replyToken, userId, displayName, text) {
  const parts = text.split(' ');
  if (parts.length < 3) {
    await replyMessage(replyToken, 'รูปแบบ: #ส่งงาน <รหัสงาน> <ข้อความ>\nตัวอย่าง: #ส่งงาน ABC123 เสร็จแล้วครับ');
    return;
  }

  const taskId = parts[1];
  const replyText = parts.slice(2).join(' ');
  const task = await TaskDB.getTaskById(taskId);

  if (!task) {
    await replyMessage(replyToken, `ไม่พบงานรหัส ${taskId} ครับ`);
    return;
  }

  if (task.assignee_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้รับผิดชอบงานรหัส ${taskId} ครับ`);
    return;
  }

  if (task.status === 'completed') {
    await replyMessage(replyToken, `งานรหัส ${taskId} เสร็จสิ้นไปแล้วครับ`);
    return;
  }

  if (task.status === 'submitted') {
    await replyMessage(replyToken, `งานรหัส ${taskId} ส่งไปรอตรวจแล้วครับ`);
    return;
  }

  // ถ้ายังไม่ได้รับงาน ให้รับอัตโนมัติ
  if (task.status === 'pending') {
    await TaskDB.acceptTask(taskId);
  }

  // บันทึกเป็น submitted (รอตรวจ)
  await TaskDB.replyToTask(taskId, replyText);

  // ตอบกลับใน DM ผู้ส่งงาน
  const flexMsg = buildFlexTaskSubmitted(taskId, task.assigner_name, displayName, task.message, replyText);
  try {
    await client.replyMessage({ replyToken, messages: [flexMsg] });
  } catch (err) {
    await replyMessage(replyToken, `📨 ส่งงานรหัส ${taskId} ไปรอตรวจแล้วครับ!`);
  }

  // ส่ง DM ไปหาผู้สั่งงาน เพื่อตรวจ
  const reviewFlex = buildFlexReviewRequest(taskId, task.assigner_name, displayName, task.message, replyText);
  const dmSent = await sendDM(task.assigner_id, [reviewFlex]);

  if (!dmSent) {
    // ถ้าส่ง DM ไม่ได้ → แจ้งในกลุ่ม
    try {
      await client.pushMessage({
        to: task.group_id,
        messages: [{
          type: 'textV2',
          text: `📨 {assignee} ส่งงานรหัส ${taskId} แล้ว!\n{assigner} กรุณาตรวจงานด้วยครับ\n\n💬 "${replyText.substring(0, 100)}"`,
          substitution: {
            assignee: { type: 'mention', mentionee: { type: 'user', userId: userId } },
            assigner: { type: 'mention', mentionee: { type: 'user', userId: task.assigner_id } }
          }
        }]
      });
    } catch (e) {
      console.log('Could not notify group:', e.message);
    }
  }
}

// ── DM: อนุมัติงาน ──
async function handleApproveTask(replyToken, userId, displayName, text) {
  const taskId = text.replace(/^#(อนุมัติ|approve)\s*/, '').trim();
  if (!taskId) {
    await replyMessage(replyToken, 'รูปแบบ: #อนุมัติ <รหัสงาน>\nตัวอย่าง: #อนุมัติ ABC123');
    return;
  }

  const task = await TaskDB.getTaskById(taskId);
  if (!task) {
    await replyMessage(replyToken, `ไม่พบงานรหัส ${taskId} ครับ`);
    return;
  }

  if (task.assigner_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้สั่งงานรหัส ${taskId} ครับ ไม่สามารถอนุมัติได้`);
    return;
  }

  if (task.status !== 'submitted') {
    await replyMessage(replyToken, `งานรหัส ${taskId} ไม่ได้อยู่ในสถานะรอตรวจครับ (สถานะ: ${task.status})`);
    return;
  }

  // อนุมัติ
  await TaskDB.approveTask(taskId);

  // คำนวณแต้ม
  let earnedPoints = 5;
  let pointReason = 'สำเร็จ!';
  let onTime = true;

  if (task.deadline) {
    const repliedAt = task.replied_at ? new Date(task.replied_at) : new Date();
    const dl = new Date(task.deadline);
    const hoursEarly = (dl - repliedAt) / (1000 * 60 * 60);

    if (hoursEarly > 1) {
      earnedPoints = 15;
      pointReason = 'เสร็จก่อนกำหนด!';
    } else if (hoursEarly >= 0) {
      earnedPoints = 10;
      pointReason = 'ตรงเวลา!';
    } else {
      earnedPoints = 5;
      pointReason = 'เลยกำหนด';
      onTime = false;
    }
  } else {
    earnedPoints = 10;
  }

  await TaskDB.addPoints(task.group_id, task.assignee_id, task.assignee_name, earnedPoints, taskId, pointReason);
  await TaskDB.recordTaskCompleted(task.group_id, task.assignee_id, task.assignee_name, onTime);
  const currentPoints = await TaskDB.getPoints(task.group_id, task.assignee_id);
  const pointsInfo = {
    earned: earnedPoints,
    reason: pointReason,
    total: currentPoints ? currentPoints.total_points : earnedPoints,
    streak: currentPoints ? currentPoints.current_streak : (onTime ? 1 : 0)
  };

  // ตอบกลับผู้อนุมัติ
  await replyMessage(replyToken, `✅ อนุมัติงานรหัส ${taskId} แล้วครับ!\n\n📝 ${task.message}\n👤 ทำโดย: ${task.assignee_name}\n💎 +${earnedPoints} แต้ม (${pointReason})`);

  // แจ้ง DM ผู้ทำงาน
  const completedFlex = buildFlexTaskCompleted(taskId, task.assigner_name, task.assignee_name, task.message, task.reply_message || '', pointsInfo);
  const dmSent = await sendDM(task.assignee_id, [completedFlex]);

  // แจ้งในกลุ่ปด้วย
  try {
    await client.pushMessage({
      to: task.group_id,
      messages: [{
        type: 'textV2',
        text: `🎉 งานรหัส ${taskId} สำเร็จ!\n{assignee} ได้ +${earnedPoints} แต้ม (${pointReason})`,
        substitution: {
          assignee: { type: 'mention', mentionee: { type: 'user', userId: task.assignee_id } }
        }
      }]
    });
  } catch (e) {
    console.log('Could not notify group:', e.message);
  }
}

// ── DM: แก้ไข/ส่งกลับงาน ──
async function handleRejectTask(replyToken, userId, displayName, text) {
  const parts = text.replace(/^#(แก้ไข|reject)\s*/, '').trim().split(/\s+/);
  const taskId = parts[0];
  const reason = parts.slice(1).join(' ') || 'กรุณาแก้ไขและส่งใหม่';

  if (!taskId) {
    await replyMessage(replyToken, 'รูปแบบ: #แก้ไข <รหัสงาน> <เหตุผล>\nตัวอย่าง: #แก้ไข ABC123 ข้อมูลไม่ครบ');
    return;
  }

  const task = await TaskDB.getTaskById(taskId);
  if (!task) {
    await replyMessage(replyToken, `ไม่พบงานรหัส ${taskId} ครับ`);
    return;
  }

  if (task.assigner_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้สั่งงานรหัส ${taskId} ครับ`);
    return;
  }

  if (task.status !== 'submitted') {
    await replyMessage(replyToken, `งานรหัส ${taskId} ไม่ได้อยู่ในสถานะรอตรวจครับ`);
    return;
  }

  // ส่งกลับแก้ไข (กลับเป็น accepted)
  await TaskDB.rejectTask(taskId, reason);

  await replyMessage(replyToken, `🔄 ส่งงานรหัส ${taskId} กลับไปแก้ไขแล้วครับ\n📝 เหตุผล: ${reason}`);

  // แจ้ง DM ผู้ทำงาน
  const rejectFlex = buildFlexTaskRejected(taskId, task.assigner_name, task.assignee_name, task.message, reason);
  const dmSent = await sendDM(task.assignee_id, [rejectFlex]);

  if (!dmSent) {
    try {
      await client.pushMessage({
        to: task.group_id,
        messages: [{
          type: 'textV2',
          text: `🔄 {assigner} ส่งงานรหัส ${taskId} กลับมาแก้ไข\n{assignee} กรุณาแก้ไขและส่งใหม่ครับ\n\n📝 เหตุผล: ${reason}`,
          substitution: {
            assignee: { type: 'mention', mentionee: { type: 'user', userId: task.assignee_id } },
            assigner: { type: 'mention', mentionee: { type: 'user', userId: task.assigner_id } }
          }
        }]
      });
    } catch (e) {
      console.log('Could not notify group:', e.message);
    }
  }
}

// ── DM: ดูงานทั้งหมด (ข้ามกลุ่ม) ──
async function showMyTasksDM(replyToken, userId) {
  const tasks = await TaskDB.getTasksByUserId(userId);
  if (tasks.length === 0) {
    await replyMessage(replyToken, 'คุณไม่มีงานในระบบครับ 🎉');
    return;
  }

  let text = `📋 งานทั้งหมดของคุณ (${tasks.length} งาน):\n\n`;
  tasks.forEach((task, index) => {
    const statusIcon = task.status === 'completed' ? '✅' : task.status === 'submitted' ? '📨' : task.status === 'accepted' ? '👍' : '⏳';
    const statusText = task.status === 'submitted' ? ' (รอตรวจ)' : '';
    text += `${index + 1}. ${statusIcon} [${task.task_id}] ${task.message.substring(0, 30)}${task.message.length > 30 ? '...' : ''}${statusText}\n`;
    text += `   จาก: ${task.assigner_name} | ${formatDate(task.created_at)}\n\n`;
  });
  await replyMessage(replyToken, text);
}

// ── DM: ดูงานค้าง ──
async function showPendingTasksDM(replyToken, userId) {
  const pending = await TaskDB.getTasksByUserId(userId, 'pending');
  const accepted = await TaskDB.getTasksByUserId(userId, 'accepted');
  const tasks = [...pending, ...accepted];

  if (tasks.length === 0) {
    await replyMessage(replyToken, 'ไม่มีงานค้างครับ! 🎉');
    return;
  }

  let text = `⏳ งานที่ยังไม่เสร็จ (${tasks.length} งาน):\n\n`;
  tasks.forEach((task, index) => {
    const icon = task.status === 'accepted' ? '👍' : '⏳';
    text += `${index + 1}. ${icon} [${task.task_id}] ${task.message}\n`;
    text += `   จาก: ${task.assigner_name}\n`;
    if (task.status === 'pending') {
      text += `   💡 พิมพ์: #รับงาน ${task.task_id} <กำหนดส่ง>\n\n`;
    } else {
      text += `   💡 พิมพ์: #ส่งงาน ${task.task_id} <ข้อความ>\n\n`;
    }
  });
  await replyMessage(replyToken, text);
}

// ── DM: Help message ──
async function sendDMHelpMessage(replyToken) {
  const helpText = `🤖 คู่มือ อู่อันโหว (DM)\n\n` +
    `💪 รับงาน (+5 แต้ม):\n` +
    `   #รับงาน <รหัสงาน> <กำหนดส่ง>\n\n` +
    `📨 ส่งงาน (รอตรวจ):\n` +
    `   #ส่งงาน <รหัสงาน> <ข้อความ>\n\n` +
    `✅ อนุมัติงาน (สำหรับผู้สั่ง):\n` +
    `   #อนุมัติ <รหัสงาน>\n\n` +
    `🔄 แก้ไข (ส่งกลับแก้):\n` +
    `   #แก้ไข <รหัสงาน> <เหตุผล>\n\n` +
    `📋 ดูงาน:\n` +
    `   #งานที่ต้องทำ | #งานค้าง\n\n` +
    `📌 สั่งงาน → ใช้ในกลุ่ปเท่านั้น\n` +
    `❓ #help - แสดงคู่มือนี้`;
  await replyMessage(replyToken, helpText);
}

// สร้างงานใหม่
async function createTask(event, mentionees, assignerName) {
  const { text } = event.message;
  const { groupId, userId: assignerId } = event.source;
  
  // สร้าง task ID แบบสั้น
  const taskId = generateTaskId();
  
  // ดึงข้อความงาน (ลบ #สั่งงาน และ mention ออก)
  let taskMessage = text.replace(/^#สั่งงาน\s*/, '');
  mentionees.forEach(mention => {
    taskMessage = taskMessage.replace(mention.text, '').trim();
  });
  
  // ถ้าไม่มีข้อความงาน ให้ใช้ข้อความเริ่มต้น
  if (!taskMessage) {
    taskMessage = 'ไม่มีรายละเอียดงาน';
  }

  // สร้างงานสำหรับแต่ละคนที่ถูก tag
  const createdTasks = [];
  
  for (const mention of mentionees) {
    // ข้ามถ้า tag ตัวเอง
    if (mention.userId === assignerId) continue;
    
    // ดึงข้อมูลผู้ถูกมอบหมาย
    const assigneeProfile = await getUserProfile(groupId, mention.userId);
    const assigneeName = assigneeProfile?.displayName || mention.text.replace('@', '');
    
    // บันทึกลงฐานข้อมูล
    await TaskDB.createTask({
      taskId,
      groupId,
      assignerId,
      assignerName,
      assigneeId: mention.userId,
      assigneeName,
      message: taskMessage
    });
    
    createdTasks.push({
      taskId,
      assigneeName,
      assigneeId: mention.userId
    });
  }

  if (createdTasks.length > 0) {
    const taskId = createdTasks[0].taskId;
    const assigneeNames = createdTasks.map(t => t.assigneeName).join(', ');

    // ─── ส่ง DM ไปหาผู้รับงานแต่ละคน ───
    const dmFailedUsers = [];
    for (const ct of createdTasks) {
      const dmFlex = buildFlexDMTaskAssigned(taskId, assignerName, ct.assigneeName, taskMessage);
      const sent = await sendDM(ct.assigneeId, [dmFlex]);
      if (!sent) dmFailedUsers.push(ct);
    }

    // ─── แจ้งเตือนสั้นๆ ในกลุ่ม (Flex Message) ───
    const hasDMFail = dmFailedUsers.length > 0;
    const groupFlex = buildFlexGroupNotify(taskId, assignerName, assigneeNames, taskMessage, hasDMFail);

    try {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [groupFlex]
      });
    } catch (err) {
      console.error('Error sending group flex:', err);
      await replyMessage(event.replyToken, `📌 งานใหม่ ${taskId}: ${taskMessage}\nมอบให้: ${assigneeNames}`);
    }
  }
}

// แปลงวันที่จากข้อความไทย เช่น "10/04 15:00", "10/04/2026 15:00", "พรุ่งนี้ 15:00", "วันนี้ 18:00"
function parseDeadline(text) {
  const now = new Date();
  
  // รูปแบบ "พรุ่งนี้ HH:MM"
  let match = text.match(/พรุ่งนี้\s*(\d{1,2})[:.:](\d{2})/);
  if (match) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
    return d;
  }

  // รูปแบบ "วันนี้ HH:MM" หรือ "HH:MM"
  match = text.match(/(?:วันนี้\s*)?(\d{1,2})[:.:](\d{2})$/);
  if (match && !text.match(/\d{1,2}\/\d{1,2}/)) {
    const d = new Date(now);
    d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1); // ถ้าเวลาผ่านไปแล้ว ให้เป็นพรุ่งนี้
    return d;
  }

  // รูปแบบ "DD/MM HH:MM" หรือ "DD/MM/YYYY HH:MM"
  match = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2})[:.:](\d{2})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    let year = match[3] ? parseInt(match[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (year > 2500) year -= 543; // แปลง พ.ศ. เป็น ค.ศ.
    const hour = parseInt(match[4]);
    const min = parseInt(match[5]);
    return new Date(year, month, day, hour, min, 0);
  }

  return null;
}

// จัดรูปแบบ deadline เป็นข้อความไทย
function formatDeadline(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// จัดการรับงาน
async function handleAcceptTask(replyToken, groupId, userId, displayName, text) {
  const parts = text.replace('#รับงาน', '').trim().split(/\s+/);
  
  // หา task ID (ถ้ามี)
  let taskId = null;
  let deadlineText = '';
  
  if (parts.length > 0 && parts[0].match(/^[A-Z0-9]{6}$/)) {
    taskId = parts[0];
    deadlineText = parts.slice(1).join(' ');
  } else {
    deadlineText = parts.join(' ');
  }

  // หางาน
  let task;
  if (taskId) {
    task = await TaskDB.getTaskById(taskId);
  } else {
    const pendingTasks = await TaskDB.getTasksByAssignee(groupId, userId, 'pending');
    task = pendingTasks.length > 0 ? pendingTasks[0] : null;
  }

  if (!task) {
    await replyMessage(replyToken, 'ไม่พบงานที่รอรับครับ');
    return;
  }

  if (task.assignee_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้รับผิดชอบงานรหัส ${task.task_id} ครับ`);
    return;
  }

  if (task.status === 'accepted') {
    await replyMessage(replyToken, `คุณรับงานรหัส ${task.task_id} ไปแล้วครับ`);
    return;
  }

  if (task.status === 'completed') {
    await replyMessage(replyToken, `งานรหัส ${task.task_id} เสร็จสิ้นไปแล้วครับ`);
    return;
  }

  // ต้องระบุกำหนดส่ง
  if (!deadlineText) {
    try {
      await client.replyMessage({
        replyToken,
        messages: [{
          type: 'text',
          text: `📅 กรุณาระบุกำหนดส่งด้วยครับ\n\nพิมพ์: #รับงาน ${task.task_id} <กำหนดส่ง>\n\nตัวอย่าง:\n• #รับงาน ${task.task_id} วันนี้ 18:00\n• #รับงาน ${task.task_id} พรุ่งนี้ 12:00\n• #รับงาน ${task.task_id} 15/04 09:00`,
          quickReply: {
            items: [
              {
                type: 'action',
                action: { type: 'message', label: '⏰ วันนี้ 18:00', text: `#รับงาน ${task.task_id} วันนี้ 18:00` }
              },
              {
                type: 'action',
                action: { type: 'message', label: '📅 พรุ่งนี้ 12:00', text: `#รับงาน ${task.task_id} พรุ่งนี้ 12:00` }
              },
              {
                type: 'action',
                action: { type: 'message', label: '📅 พรุ่งนี้ 18:00', text: `#รับงาน ${task.task_id} พรุ่งนี้ 18:00` }
              }
            ]
          }
        }]
      });
    } catch (err) {
      await replyMessage(replyToken, `📅 กรุณาระบุกำหนดส่งด้วยครับ\n\nพิมพ์: #รับงาน ${task.task_id} <กำหนดส่ง>\nตัวอย่าง: #รับงาน ${task.task_id} พรุ่งนี้ 12:00`);
    }
    return;
  }

  // แปลงกำหนดส่ง
  const deadline = parseDeadline(deadlineText);
  if (!deadline) {
    await replyMessage(replyToken, `❌ รูปแบบวันที่ไม่ถูกต้อง\n\nตัวอย่างที่ใช้ได้:\n• วันนี้ 18:00\n• พรุ่งนี้ 12:00\n• 15/04 09:00\n• 15/04/2026 09:00`);
    return;
  }

  // บันทึก
  await TaskDB.acceptTask(task.task_id, deadline.toISOString());

  // ให้แต้มรับงาน +5
  const ACCEPT_POINTS = 5;
  await TaskDB.addPoints(groupId, userId, displayName, ACCEPT_POINTS, task.task_id, 'รับภารกิจ');
  const currentPoints = await TaskDB.getPoints(groupId, userId);
  const totalPts = currentPoints ? currentPoints.total_points : ACCEPT_POINTS;

  // ตอบกลับด้วย Flex Message + tag ผู้มอบหมาย
  const flexMsg = buildFlexTaskAccepted(task.task_id, task.assigner_name, displayName, task.message, formatDeadline(deadline), ACCEPT_POINTS, totalPts);

  const mentionMsg = {
    type: 'textV2',
    text: `👍 ${displayName} รับงานรหัส ${task.task_id} แล้ว! {assigner}`,
    substitution: {
      assigner: {
        type: 'mention',
        mentionee: { type: 'user', userId: task.assigner_id }
      }
    }
  };

  try {
    await client.replyMessage({
      replyToken,
      messages: [flexMsg, mentionMsg]
    });
  } catch (err) {
    console.error('Error sending flex:', err);
    const fallback = `👍 รับงานแล้ว!\nรหัส: ${task.task_id}\nรายละเอียด: ${task.message}\nกำหนดส่ง: ${formatDeadline(deadline)}`;
    await replyMessage(replyToken, fallback);
  }
}

// จัดการการตอบกลับงาน (ในกลุ่ป - ยังรองรับอยู่)
async function handleTaskReply(replyToken, groupId, userId, displayName, text) {
  const parts = text.split(' ');
  if (parts.length < 3) {
    await replyMessage(replyToken, 'รูปแบบ: #ส่งงาน <รหัสงาน> <ข้อความ>\nตัวอย่าง: #ส่งงาน ABC123 เสร็จแล้วครับ\n\n💡 แนะนำ: ส่งงานผ่าน DM จะสะดวกกว่า!');
    return;
  }

  const taskId = parts[1];
  const replyText = parts.slice(2).join(' ');
  const task = await TaskDB.getTaskById(taskId);

  if (!task) {
    await replyMessage(replyToken, `ไม่พบงานรหัส ${taskId} ครับ`);
    return;
  }

  if (task.assignee_id !== userId) {
    await replyMessage(replyToken, `คุณไม่ใช่ผู้รับผิดชอบงานรหัส ${taskId} ครับ`);
    return;
  }

  if (task.status === 'completed') {
    await replyMessage(replyToken, `งานรหัส ${taskId} เสร็จสิ้นไปแล้วครับ`);
    return;
  }

  if (task.status === 'submitted') {
    await replyMessage(replyToken, `งานรหัส ${taskId} ส่งไปรอตรวจแล้วครับ`);
    return;
  }

  // ถ้ายังไม่ได้รับ ให้รับอัตโนมัติ
  if (task.status === 'pending') {
    await TaskDB.acceptTask(taskId);
  }

  // บันทึกเป็น submitted (รอตรวจ)
  await TaskDB.replyToTask(taskId, replyText);

  // แจ้งในกลุ่ปสั้นๆ
  await replyMessage(replyToken, `📨 ${displayName} ส่งงานรหัส ${taskId} ไปรอตรวจแล้วครับ!`);

  // ส่ง DM ไปหาผู้สั่งงาน เพื่อตรวจ
  const reviewFlex = buildFlexReviewRequest(taskId, task.assigner_name, displayName, task.message, replyText);
  const dmSent = await sendDM(task.assigner_id, [reviewFlex]);

  if (!dmSent) {
    // fallback: แจ้งในกลุ่ป
    try {
      await client.pushMessage({
        to: groupId,
        messages: [{
          type: 'textV2',
          text: `{assigner} มีงานรหัส ${taskId} รอตรวจครับ\nพิมพ์ #อนุมัติ ${taskId} หรือ #แก้ไข ${taskId} <เหตุผล>`,
          substitution: {
            assigner: { type: 'mention', mentionee: { type: 'user', userId: task.assigner_id } }
          }
        }]
      });
    } catch (e) {
      console.log('Could not notify assigner:', e.message);
    }
  }
}

// แสดงงานทั้งหมดของฉัน
async function showMyTasks(replyToken, groupId, userId) {
  const tasks = await TaskDB.getTasksByAssignee(groupId, userId);
  
  if (tasks.length === 0) {
    await replyMessage(replyToken, 'คุณไม่มีงานในระบบครับ 🎉');
    return;
  }

  let text = `📋 งานทั้งหมดของคุณ (${tasks.length} งาน):\n\n`;
  
  tasks.forEach((task, index) => {
    const status = task.status === 'completed' ? '✅' : task.status === 'accepted' ? '👍' : '⏳';
    text += `${index + 1}. ${status} [${task.task_id}] ${task.message.substring(0, 30)}${task.message.length > 30 ? '...' : ''}\n`;
    text += `   จาก: ${task.assigner_name} | ${formatDate(task.created_at)}\n\n`;
  });

  await replyMessage(replyToken, text);
}

// แสดงงานที่ยังไม่เสร็จ
async function showPendingTasks(replyToken, groupId, userId) {
  const tasks = await TaskDB.getTasksByAssignee(groupId, userId, 'pending');
  
  if (tasks.length === 0) {
    await replyMessage(replyToken, 'ไม่มีงานค้างครับ! ยอดเยี่ยม 🎉');
    return;
  }

  let text = `⏳ งานที่ยังไม่เสร็จ (${tasks.length} งาน):\n\n`;
  
  tasks.forEach((task, index) => {
    text += `${index + 1}. [${task.task_id}] ${task.message}\n`;
    text += `   จาก: ${task.assigner_name} | ${formatDate(task.created_at)}\n`;
    text += `   💡 ตอบกลับ: #ส่งงาน ${task.task_id} <ข้อความ>\n\n`;
  });

  await replyMessage(replyToken, text);
}

// สรุปงานทั้งหมดแยกรายวัน
async function showDailySummary(replyToken, groupId) {
  const tasks = await TaskDB.getAllTasksChronological(groupId);
  
  if (tasks.length === 0) {
    await replyMessage(replyToken, 'ยังไม่มีงานในกลุ่มนี้เลยครับ');
    return;
  }

  // จัดกลุ่มงานตามวันที่สร้าง
  const dailyMap = {};
  for (const task of tasks) {
    const date = new Date(task.created_at);
    const dayKey = date.toLocaleDateString('th-TH', { 
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' 
    });
    if (!dailyMap[dayKey]) dailyMap[dayKey] = [];
    dailyMap[dayKey].push(task);
  }

  // นับสถิติรวม
  const totalTasks = tasks.length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const acceptedCount = tasks.filter(t => t.status === 'accepted').length;

  // สร้างข้อความ
  let text = `📊 สรุปงานในกลุ่ป\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `📋 ทั้งหมด ${totalTasks} งาน\n`;
  text += `✅ เสร็จ ${completedCount} | 👍 รับแล้ว ${acceptedCount} | ⏳ รอ ${pendingCount}\n`;
  text += `━━━━━━━━━━━━━━━\n\n`;

  const days = Object.keys(dailyMap);
  for (const day of days) {
    const dayTasks = dailyMap[day];
    const dayDone = dayTasks.filter(t => t.status === 'completed').length;

    text += `📅 ${day} (${dayTasks.length} งาน, เสร็จ ${dayDone})\n`;

    for (const task of dayTasks) {
      const icon = task.status === 'completed' ? '✅' : task.status === 'accepted' ? '👍' : '⏳';
      const msgShort = task.message.length > 25 ? task.message.substring(0, 25) + '...' : task.message;
      text += `  ${icon} [${task.task_id}] ${msgShort}\n`;
      text += `     → ${task.assignee_name}`;
      if (task.status === 'completed' && task.replied_at) {
        text += ` (ส่งแล้ว)`;
      } else if (task.deadline) {
        const dl = new Date(task.deadline);
        const now = new Date();
        if (dl < now) {
          text += ` ⚠️ เลยกำหนด`;
        } else {
          text += ` ⏰ กำหนด ${dl.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${dl.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
        }
      }
      text += `\n`;
    }
    text += `\n`;
  }

  // LINE message limit = 5000 chars
  if (text.length > 4900) {
    // ถ้ายาวเกิน ให้ส่งเป็น 2 ข้อความ
    const midPoint = text.lastIndexOf('\n\n', Math.floor(text.length / 2));
    const part1 = text.substring(0, midPoint) + '\n\n(ต่อ...)';
    const part2 = '(ต่อ) ' + text.substring(midPoint).trim();

    try {
      await client.replyMessage({
        replyToken,
        messages: [
          { type: 'text', text: part1.substring(0, 5000) },
          { type: 'text', text: part2.substring(0, 5000) }
        ]
      });
    } catch (err) {
      console.error('Error sending summary:', err);
      await replyMessage(replyToken, part1.substring(0, 5000));
    }
  } else {
    await replyMessage(replyToken, text);
  }
}

// สรุปการพูดคุยในกลุ่มแยกรายวัน
async function showChatSummary(replyToken, groupId) {
  const logs = await TaskDB.getChatLogsChronological(groupId);

  if (logs.length === 0) {
    await replyMessage(replyToken, 'ยังไม่มีบันทึกการพูดคุยในกลุ่มนี้ครับ\n\n(ระบบเริ่มบันทึกตั้งแต่เปิดฟีเจอร์นี้)');
    return;
  }

  // จัดกลุ่มตามวัน
  const dailyMap = {};
  for (const log of logs) {
    const date = new Date(log.created_at);
    const dayKey = date.toLocaleDateString('th-TH', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
    if (!dailyMap[dayKey]) dailyMap[dayKey] = [];
    dailyMap[dayKey].push(log);
  }

  // สถิติรวม
  const uniqueUsers = [...new Set(logs.map(l => l.user_id))];

  let text = `💬 สรุปการพูดคุยในกลุ่ม\n`;
  text += `━━━━━━━━━━━━━━━\n`;
  text += `📝 ข้อความทั้งหมด ${logs.length} ข้อความ\n`;
  text += `👥 สมาชิกที่พูดคุย ${uniqueUsers.length} คน\n`;
  text += `━━━━━━━━━━━━━━━\n\n`;

  const days = Object.keys(dailyMap);
  for (const day of days) {
    const dayLogs = dailyMap[day];

    // นับข้อความต่อคน ในวันนั้น
    const userMsgCount = {};
    for (const log of dayLogs) {
      const name = log.display_name || 'ไม่ระบุชื่อ';
      if (!userMsgCount[name]) userMsgCount[name] = { count: 0, messages: [] };
      userMsgCount[name].count++;
      userMsgCount[name].messages.push(log.message);
    }

    text += `📅 ${day} (${dayLogs.length} ข้อความ)\n`;

    // แสดงแต่ละคนที่พูดในวันนั้น
    for (const [name, data] of Object.entries(userMsgCount)) {
      text += `  👤 ${name} (${data.count} ข้อความ)\n`;
      // แสดงข้อความล่าสุด 3 ข้อความ
      const recent = data.messages.slice(-3);
      for (const msg of recent) {
        const short = msg.length > 40 ? msg.substring(0, 40) + '...' : msg;
        text += `     💭 "${short}"\n`;
      }
      if (data.messages.length > 3) {
        text += `     ... อีก ${data.messages.length - 3} ข้อความ\n`;
      }
    }
    text += `\n`;
  }

  // LINE message limit = 5000 chars, แบ่งถ้ายาวเกิน
  if (text.length > 4900) {
    const midPoint = text.lastIndexOf('\n\n', Math.floor(text.length / 2));
    const part1 = text.substring(0, midPoint) + '\n\n(ต่อ...)';
    const part2 = '(ต่อ) ' + text.substring(midPoint).trim();

    try {
      await client.replyMessage({
        replyToken,
        messages: [
          { type: 'text', text: part1.substring(0, 5000) },
          { type: 'text', text: part2.substring(0, 5000) }
        ]
      });
    } catch (err) {
      console.error('Error sending chat summary:', err);
      await replyMessage(replyToken, part1.substring(0, 5000));
    }
  } else {
    await replyMessage(replyToken, text);
  }
}

// แสดงแต้มของตัวเอง
async function showMyPoints(replyToken, groupId, userId, displayName) {
  const pointsData = await TaskDB.getPoints(groupId, userId);
  const flexMsg = buildFlexMyPoints(displayName, pointsData);
  try {
    await client.replyMessage({ replyToken, messages: [flexMsg] });
  } catch (err) {
    const pts = pointsData ? pointsData.total_points : 0;
    await replyMessage(replyToken, `💎 ${displayName} มี ${pts} แต้ม`);
  }
}

// แสดงอันดับในกลุ่ม
async function showLeaderboard(replyToken, groupId) {
  const leaders = await TaskDB.getLeaderboard(groupId);
  const flexMsg = buildFlexLeaderboard(leaders);
  try {
    await client.replyMessage({ replyToken, messages: [flexMsg] });
  } catch (err) {
    let text = '🏆 อันดับแต้มในกลุ่ม:\n\n';
    const medals = ['🥇', '🥈', '🥉'];
    leaders.forEach((l, i) => {
      text += `${medals[i] || `${i+1}.`} ${l.display_name} - ${l.total_points} แต้ม\n`;
    });
    if (leaders.length === 0) text += 'ยังไม่มีข้อมูล กดรับภารกิจเลย!';
    await replyMessage(replyToken, text);
  }
}

// ส่งข้อความช่วยเหลือ
async function sendHelpMessage(replyToken) {
  const helpText = `🤖 คู่มือใช้งาน อู่อันโหว\n\n` +
    `📌 สั่งงาน:\n` +
    `   #สั่งงาน @ชื่อคน รายละเอียดงาน\n\n` +
    `💪 รับงาน (+5 แต้ม):\n` +
    `   #รับงาน - รับงานล่าสุด\n` +
    `   #รับงาน <รหัสงาน> - รับงานตามรหัส\n\n` +
    `✅ ส่งงาน (+5~15 แต้ม):\n` +
    `   #ส่งงาน <รหัสงาน> <ข้อความ>\n\n` +
    `📋 ดูงาน:\n` +
    `   #งานที่ต้องทำ | #งานค้าง\n` +
    `   #สรุปงาน | #สรุปแชท\n\n` +
    `💎 แต้มสะสม:\n` +
    `   #แต้ม - ดูแต้มของฉัน\n` +
    `   #อันดับ - ดูอันดับในกลุ่ม\n\n` +
    `❓ #help - แสดงคู่มือนี้`;

  await replyMessage(replyToken, helpText);
}

// จัดการเมื่อบอทถูกเชิญเข้ากลุ่ม
async function handleJoinEvent(event) {
  const { groupId } = event.source;
  console.log(`Bot joined group: ${groupId}`);
  
  await replyMessage(event.replyToken, 
    `สวัสดีครับ 👋 ผมเป็น AI ผู้ช่วยสรุปงานให้พี่โอ และตามงานของกลุ่มนี้ครับ\n\n` +
    `สงสัยว่าผมทำอะไรได้บ้าง ถามผมได้เลย!\n\n` +
    `เพิ่มเพื่อนผมไว้ด้วยนะครับ จะได้คุยกันผ่าน DM ได้ 👇\n` +
    `https://line.me/R/ti/p/@909kiqvu`
  );
}

// จัดการเมื่อมีสมาชิกเข้ากลุ่ม
async function handleMemberJoined(event) {
  const { groupId } = event.source;
  const joinedMembers = event.joined.members;
  
  for (const member of joinedMembers) {
    if (member.type === 'user') {
      const profile = await getUserProfile(groupId, member.userId);
      if (profile) {
        await TaskDB.saveMember(groupId, member.userId, profile.displayName);
      }
      
      // ส่ง DM แนะนำตัวให้สมาชิกใหม่
      await sendDM(member.userId, 
        `สวัสดีครับ 👋 ผมเป็น AI ผู้ช่วยสรุปงานให้พี่โอ และตามงานของกลุ่มนี้ครับ\n\n` +
        `แจ้งเตือนงานต่างๆ ผมจะส่งมาทาง DM นี้เลยนะครับ\n\n` +
        `สงสัยว่าผมทำอะไรได้บ้าง ถามผมได้เลย!`
      );
    }
  }
}

// ดึงข้อมูลผู้ใช้
async function getUserProfile(groupId, userId) {
  try {
    const profile = await client.getGroupMemberProfile(groupId, userId);
    return profile;
  } catch (err) {
    console.error('Error getting user profile:', err);
    return null;
  }
}

// ส่งข้อความตอบกลับ
async function replyMessage(replyToken, text) {
  try {
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text }]
    });
  } catch (err) {
    console.error('Error replying message:', err);
  }
}

// ส่ง DM (push message) ไปหาผู้ใช้
async function sendDM(userId, messages) {
  try {
    if (!Array.isArray(messages)) messages = [messages];
    messages = messages.map(m => typeof m === 'string' ? { type: 'text', text: m } : m);
    await client.pushMessage({ to: userId, messages });
    return true;
  } catch (err) {
    console.error(`❌ ส่ง DM ไม่ได้ (${userId}):`, err.message);
    return false;
  }
}

// ดึงข้อมูลผู้ใช้ใน DM (ไม่ต้องมี groupId)
async function getUserProfileDM(userId) {
  try {
    return await client.getProfile(userId);
  } catch (err) {
    console.error('Error getting DM profile:', err);
    return null;
  }
}

// สร้างรหัสงานแบบสั้น
function generateTaskId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// จัดรูปแบบข้อความงานที่สร้าง
function formatTaskCreatedMessage(tasks, assignerName, message) {
  const taskId = tasks[0].taskId;
  const assigneeNames = tasks.map(t => t.assigneeName).join(', ');
  
  return `📋 สร้างงานใหม่แล้ว!\n\n` +
    `🆔 รหัสงาน: ${taskId}\n` +
    `👤 มอบให้: ${assigneeNames}\n` +
    `📝 รายละเอียด: ${message}\n` +
    `👨‍💼 โดย: ${assignerName}\n\n` +
    `💡 ผู้รับงานตอบกลับด้วย:\n` +
    `#ส่งงาน ${taskId} <ข้อความ>`;
}

// จัดรูปแบบวันที่
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// ═══════════════════════════════════════════
// ═══ LINE Flex Message Templates ═══
// ═══════════════════════════════════════════

// ข้อความให้กำลังใจแบบสุ่ม
const MOTIVATIONAL_MSGS = [
  'ทำได้แน่นอน! 💪', 'ลุยเลยครับพี่! 🔥', 'เชื่อมือทีมครับ! 🤝',
  'งานนี้เล็กน้อย! 😎', 'พร้อมซัพพอร์ตครับ! 🙌', 'โชว์ฝีมือเลย! ⭐',
  'ทีมเราสุดยอด! 🏆', 'จัดให้เลยครับ! 🚀'
];
function randomMotivation() {
  return MOTIVATIONAL_MSGS[Math.floor(Math.random() * MOTIVATIONAL_MSGS.length)];
}

// Helper: สร้างแถวข้อมูลใน Flex Message
function createFlexRow(label, value, valueColor = '#333333') {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#AAAAAA', flex: 3 },
      { type: 'text', text: value || '-', size: 'sm', color: valueColor, flex: 5, align: 'end', weight: 'bold', wrap: true }
    ]
  };
}

// Flex: สร้างงานใหม่ (สีส้ม) — ภารกิจใหม่!
function buildFlexTaskCreated(taskId, assignerName, assigneeNames, taskMessage) {
  return {
    type: 'flex',
    altText: `📋 ภารกิจใหม่ [${taskId}] ${taskMessage.substring(0, 60)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '🎯', size: 'xxl', flex: 0 },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'ภารกิจใหม่มาแล้ว!', color: '#FFFFFF', size: 'lg', weight: 'bold' },
              { type: 'text', text: `รหัส ${taskId} | 💎 รับ +5 ทำเสร็จ +10~15`, color: '#FFFFFF99', size: 'xs' }
            ],
            flex: 1,
            margin: 'lg'
          }
        ],
        alignItems: 'center',
        backgroundColor: '#FF8C00',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              createFlexRow('สั่งโดย', assignerName, '#666666'),
              createFlexRow('มอบให้', assigneeNames, '#FF8C00'),
              createFlexRow('สถานะ', '⏳ รอรับภารกิจ', '#FF8C00')
            ],
            margin: 'lg',
            spacing: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: randomMotivation(), size: 'sm', color: '#FF8C00', align: 'center', weight: 'bold' }
            ],
            margin: 'lg',
            backgroundColor: '#FFF3E0',
            paddingAll: '10px',
            cornerRadius: '8px'
          }
        ],
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: '💪 รับภารกิจ (+5 แต้ม)', text: `#รับงาน ${taskId}` },
            style: 'primary',
            color: '#FF8C00',
            height: 'sm'
          }
        ],
        paddingAll: '15px'
      },
      styles: { footer: { separator: true } }
    }
  };
}

// Flex: รับงานแล้ว (สีน้ำเงิน) + แต้ม
function buildFlexTaskAccepted(taskId, assignerName, accepterName, taskMessage, deadlineText, pointsEarned, totalPoints) {
  return {
    type: 'flex',
    altText: `💪 ${accepterName} รับภารกิจ [${taskId}] แล้ว!`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '💪', size: 'xxl', flex: 0 },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'รับภารกิจแล้ว!', color: '#FFFFFF', size: 'lg', weight: 'bold' },
              { type: 'text', text: `+${pointsEarned} แต้ม! | รวม ${totalPoints} แต้ม`, color: '#FFFFFF99', size: 'xs' }
            ],
            flex: 1,
            margin: 'lg'
          }
        ],
        alignItems: 'center',
        backgroundColor: '#1E88E5',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              createFlexRow('สั่งโดย', assignerName, '#666666'),
              createFlexRow('รับโดย', accepterName, '#1E88E5'),
              createFlexRow('กำหนดส่ง', deadlineText, '#E53935'),
            ],
            margin: 'lg',
            spacing: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '🏆 เสร็จก่อนกำหนด = +15 แต้ม!', size: 'sm', color: '#1E88E5', align: 'center', weight: 'bold' }
            ],
            margin: 'lg',
            backgroundColor: '#E3F2FD',
            paddingAll: '10px',
            cornerRadius: '8px'
          }
        ],
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: `📨 ส่งงาน ${taskId}`, text: `#ส่งงาน ${taskId} เสร็จแล้วครับ` },
            style: 'primary',
            color: '#1E88E5',
            height: 'sm'
          }
        ],
        paddingAll: '15px'
      },
      styles: { footer: { separator: true } }
    }
  };
}

// Flex: งานเสร็จสิ้น (สีเขียว) + แต้ม + streak
function buildFlexTaskCompleted(taskId, assignerName, completedByName, taskMessage, replyText, pointsInfo) {
  const streakText = pointsInfo.streak > 1 ? `🔥 ทำเสร็จติดต่อกัน ${pointsInfo.streak} งาน!` : '✅ ภารกิจสำเร็จ!';
  return {
    type: 'flex',
    altText: `🎉 ภารกิจ [${taskId}] สำเร็จ! +${pointsInfo.earned} แต้ม`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '🎉', size: 'xxl', flex: 0 },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'ภารกิจสำเร็จ!', color: '#FFFFFF', size: 'lg', weight: 'bold' },
              { type: 'text', text: `+${pointsInfo.earned} แต้ม! | รวม ${pointsInfo.total} แต้ม`, color: '#FFFFFF99', size: 'xs' }
            ],
            flex: 1,
            margin: 'lg'
          }
        ],
        alignItems: 'center',
        backgroundColor: '#43A047',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              createFlexRow('สั่งโดย', assignerName, '#666666'),
              createFlexRow('ทำสำเร็จโดย', completedByName, '#43A047'),
              createFlexRow('แต้มที่ได้', `+${pointsInfo.earned} (${pointsInfo.reason})`, '#43A047')
            ],
            margin: 'lg',
            spacing: 'md'
          },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: '💬 รายงาน', size: 'xs', color: '#AAAAAA', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: replyText, size: 'sm', color: '#555555', wrap: true }
            ],
            backgroundColor: '#F5F5F5',
            paddingAll: '12px',
            cornerRadius: '8px',
            margin: 'sm'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: streakText, size: 'sm', color: '#43A047', align: 'center', weight: 'bold' }
            ],
            margin: 'lg',
            backgroundColor: '#E8F5E9',
            paddingAll: '10px',
            cornerRadius: '8px'
          }
        ],
        paddingAll: '20px'
      }
    }
  };
}

// Flex: ทวงงานเลยกำหนด (สีแดง) — โทนให้กำลังใจ
function buildFlexOverdueReminder(taskId, assigneeName, taskMessage, deadlineText) {
  return {
    type: 'flex',
    altText: `⏰ เฮ้! อย่าลืมงาน [${taskId}] นะ`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: '⏰', size: 'xxl', flex: 0 },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'เฮ้! อย่าลืมงานนี้นะ', color: '#FFFFFF', size: 'lg', weight: 'bold' },
              { type: 'text', text: `รหัส ${taskId} | ส่งตอนนี้ยังได้แต้ม!`, color: '#FFFFFF99', size: 'xs' }
            ],
            flex: 1,
            margin: 'lg'
          }
        ],
        alignItems: 'center',
        backgroundColor: '#E53935',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              createFlexRow('ผู้รับงาน', assigneeName, '#E53935'),
              createFlexRow('กำหนดส่ง', deadlineText, '#E53935'),
              createFlexRow('สถานะ', '⏳ เลยกำหนดแล้ว', '#E53935')
            ],
            margin: 'lg',
            spacing: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '💎 ส่งเลยตอนนี้ ยังได้ +5 แต้ม!', size: 'sm', color: '#E53935', align: 'center', weight: 'bold' }
            ],
            margin: 'lg',
            backgroundColor: '#FFEBEE',
            paddingAll: '10px',
            cornerRadius: '8px'
          }
        ],
        paddingAll: '20px'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: `📨 ส่งงานเลย`, text: `#ส่งงาน ${taskId} เสร็จแล้วครับ` },
            style: 'primary',
            color: '#E53935',
            height: 'sm'
          }
        ],
        paddingAll: '15px'
      },
      styles: { footer: { separator: true } }
    }
  };
}

// Flex: แสดงแต้มของตัวเอง
function buildFlexMyPoints(displayName, pointsData) {
  const pts = pointsData || { total_points: 0, tasks_completed: 0, tasks_on_time: 0, current_streak: 0, best_streak: 0 };
  const onTimeRate = pts.tasks_completed > 0 ? Math.round((pts.tasks_on_time / pts.tasks_completed) * 100) : 0;
  return {
    type: 'flex',
    altText: `💎 ${displayName} มี ${pts.total_points} แต้ม`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '💎 แต้มสะสม', color: '#FFFFFF', size: 'lg', weight: 'bold' },
          { type: 'text', text: displayName, color: '#FFFFFF99', size: 'sm' }
        ],
        backgroundColor: '#7C4DFF',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `${pts.total_points}`, size: '3xl', weight: 'bold', color: '#7C4DFF', align: 'center' },
          { type: 'text', text: 'แต้ม', size: 'sm', color: '#AAAAAA', align: 'center' },
          { type: 'separator', margin: 'xl' },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              createFlexRow('ภารกิจสำเร็จ', `${pts.tasks_completed} งาน`, '#333333'),
              createFlexRow('ส่งตรงเวลา', `${pts.tasks_on_time} งาน (${onTimeRate}%)`, '#43A047'),
              createFlexRow('🔥 Streak ปัจจุบัน', `${pts.current_streak} งานติด`, '#FF8C00'),
              createFlexRow('🏆 Streak สูงสุด', `${pts.best_streak} งานติด`, '#7C4DFF')
            ],
            margin: 'xl',
            spacing: 'md'
          }
        ],
        paddingAll: '20px'
      }
    }
  };
}

// Flex: ลีดเดอร์บอร์ด
function buildFlexLeaderboard(leaders) {
  const medals = ['🥇', '🥈', '🥉'];
  const rows = leaders.map((l, i) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: medals[i] || `${i + 1}.`, size: 'md', flex: 1, weight: 'bold' },
      { type: 'text', text: l.display_name, size: 'sm', flex: 4, color: '#333333' },
      { type: 'text', text: `${l.total_points} แต้ม`, size: 'sm', flex: 3, align: 'end', color: '#7C4DFF', weight: 'bold' }
    ],
    paddingBottom: '8px'
  }));

  return {
    type: 'flex',
    altText: '🏆 อันดับแต้มในกลุ่ม',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🏆 อันดับแต้มในกลุ่ม', color: '#FFFFFF', size: 'lg', weight: 'bold' },
          { type: 'text', text: 'ใครทำงานเก่งที่สุด?', color: '#FFFFFF99', size: 'xs' }
        ],
        backgroundColor: '#7C4DFF',
        paddingAll: '20px'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: rows.length > 0 ? rows : [{ type: 'text', text: 'ยังไม่มีข้อมูล กดรับภารกิจเลย!', color: '#AAAAAA', size: 'sm' }],
        paddingAll: '20px'
      }
    }
  };
}

// ═══════════════════════════════════════════

// Flex: แจ้งเตือนสั้นๆ ในกลุ่ม (สั่งงานแล้ว)
function buildFlexGroupNotify(taskId, assignerName, assigneeNames, taskMessage, hasDMFail) {
  const shortMsg = taskMessage.length > 40 ? taskMessage.substring(0, 40) + '…' : taskMessage;

  const bodyContents = [
    // เนื้องาน
    { type: 'text', text: shortMsg, size: 'sm', color: '#333333', weight: 'bold', wrap: true },
    // ใครสั่ง → ใครรับ (บรรทัดเดียว)
    {
      type: 'text',
      text: `${assignerName} → ${assigneeNames}`,
      size: 'xs', color: '#888888', margin: 'sm', wrap: true
    }
  ];

  // ถ้า DM ไม่ได้ → แนะนำ add friend สั้นๆ
  if (hasDMFail) {
    bodyContents.push({
      type: 'text',
      text: '⚠️ เพิ่มเพื่อนบอทก่อนนะ จะได้รับ DM',
      size: 'xxs', color: '#E65100', margin: 'md', wrap: true,
      action: { type: 'uri', uri: 'https://line.me/R/ti/p/@909kiqvu' }
    });
  }

  return {
    type: 'flex',
    altText: `📌 ${assignerName} → ${assigneeNames}: ${shortMsg}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'none',
        contents: bodyContents
      }
    }
  };
}

// Flex: DM — งานมาแล้ว! (ส่งไป DM ผู้รับงาน)
function buildFlexDMTaskAssigned(taskId, assignerName, assigneeName, taskMessage) {
  return {
    type: 'flex',
    altText: `📌 มีงานใหม่! [${taskId}] ${taskMessage.substring(0, 60)}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'horizontal', alignItems: 'center', backgroundColor: '#FF8C00', paddingAll: '20px',
        contents: [
          { type: 'text', text: '📬', size: 'xxl', flex: 0 },
          { type: 'box', layout: 'vertical', flex: 1, margin: 'lg', contents: [
            { type: 'text', text: 'มีงานใหม่มาให้คุณ!', color: '#FFFFFF', size: 'lg', weight: 'bold' },
            { type: 'text', text: `รหัส ${taskId} | 💎 รับ +5 ทำเสร็จ +10~15`, color: '#FFFFFF99', size: 'xs' }
          ]}
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          { type: 'box', layout: 'vertical', margin: 'lg', spacing: 'md', contents: [
            createFlexRow('สั่งโดย', assignerName, '#666666'),
            createFlexRow('มอบให้', assigneeName, '#FF8C00'),
            createFlexRow('สถานะ', '⏳ รอรับภารกิจ', '#FF8C00')
          ]},
          { type: 'box', layout: 'vertical', margin: 'lg', backgroundColor: '#FFF3E0', paddingAll: '10px', cornerRadius: '8px', contents: [
            { type: 'text', text: randomMotivation(), size: 'sm', color: '#FF8C00', align: 'center', weight: 'bold' }
          ]}
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '15px',
        contents: [
          { type: 'button', action: { type: 'message', label: '💪 รับภารกิจ', text: `#รับงาน ${taskId}` }, style: 'primary', color: '#FF8C00', height: 'sm' }
        ]
      },
      styles: { footer: { separator: true } }
    }
  };
}

// Flex: ส่งงานแล้ว รอตรวจ (สีเหลือง) — สำหรับ DM ผู้ส่งงาน
function buildFlexTaskSubmitted(taskId, assignerName, submitterName, taskMessage, replyText) {
  return {
    type: 'flex',
    altText: `📨 ส่งงาน [${taskId}] รอตรวจ`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'horizontal', alignItems: 'center', backgroundColor: '#F9A825', paddingAll: '20px',
        contents: [
          { type: 'text', text: '📨', size: 'xxl', flex: 0 },
          { type: 'box', layout: 'vertical', flex: 1, margin: 'lg', contents: [
            { type: 'text', text: 'ส่งงานแล้ว! รอตรวจ', color: '#FFFFFF', size: 'lg', weight: 'bold' },
            { type: 'text', text: `รหัส ${taskId} | ส่งไปยัง ${assignerName}`, color: '#FFFFFF99', size: 'xs' }
          ]}
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: '💬 คำตอบที่ส่ง', size: 'xs', color: '#AAAAAA', margin: 'lg' },
          { type: 'box', layout: 'vertical', backgroundColor: '#F5F5F5', paddingAll: '12px', cornerRadius: '8px', margin: 'sm', contents: [
            { type: 'text', text: replyText, size: 'sm', color: '#555555', wrap: true }
          ]},
          { type: 'box', layout: 'vertical', margin: 'lg', backgroundColor: '#FFF8E1', paddingAll: '10px', cornerRadius: '8px', contents: [
            { type: 'text', text: '⏳ รอผู้สั่งงานตรวจอนุมัติ', size: 'sm', color: '#F9A825', align: 'center', weight: 'bold' }
          ]}
        ]
      }
    }
  };
}

// Flex: ขอตรวจงาน (สีม่วง) — ส่ง DM ไปหาผู้สั่งงาน
function buildFlexReviewRequest(taskId, assignerName, submitterName, taskMessage, replyText) {
  return {
    type: 'flex',
    altText: `🔍 ${submitterName} ส่งงาน [${taskId}] มาให้ตรวจ`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'horizontal', alignItems: 'center', backgroundColor: '#7C4DFF', paddingAll: '20px',
        contents: [
          { type: 'text', text: '🔍', size: 'xxl', flex: 0 },
          { type: 'box', layout: 'vertical', flex: 1, margin: 'lg', contents: [
            { type: 'text', text: 'มีงานส่งมาให้ตรวจ!', color: '#FFFFFF', size: 'lg', weight: 'bold' },
            { type: 'text', text: `รหัส ${taskId} | จาก ${submitterName}`, color: '#FFFFFF99', size: 'xs' }
          ]}
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          { type: 'box', layout: 'vertical', margin: 'lg', spacing: 'md', contents: [
            createFlexRow('ส่งโดย', submitterName, '#7C4DFF'),
            createFlexRow('สถานะ', '📨 รอตรวจ', '#F9A825')
          ]},
          { type: 'text', text: '💬 คำตอบ', size: 'xs', color: '#AAAAAA', margin: 'lg' },
          { type: 'box', layout: 'vertical', backgroundColor: '#F5F5F5', paddingAll: '12px', cornerRadius: '8px', margin: 'sm', contents: [
            { type: 'text', text: replyText, size: 'sm', color: '#555555', wrap: true }
          ]}
        ]
      },
      footer: {
        type: 'box', layout: 'horizontal', paddingAll: '15px', spacing: 'md',
        contents: [
          { type: 'button', action: { type: 'message', label: '✅ อนุมัติ', text: `#อนุมัติ ${taskId}` }, style: 'primary', color: '#43A047', height: 'sm', flex: 1 },
          { type: 'button', action: { type: 'message', label: '🔄 แก้ไข', text: `#แก้ไข ${taskId} ` }, style: 'primary', color: '#E53935', height: 'sm', flex: 1 }
        ]
      },
      styles: { footer: { separator: true } }
    }
  };
}

// Flex: งานถูกส่งกลับแก้ไข (สีแดง) — ส่ง DM ไปหาผู้ทำงาน
function buildFlexTaskRejected(taskId, assignerName, assigneeName, taskMessage, reason) {
  return {
    type: 'flex',
    altText: `🔄 งาน [${taskId}] ต้องแก้ไข`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'horizontal', alignItems: 'center', backgroundColor: '#E53935', paddingAll: '20px',
        contents: [
          { type: 'text', text: '🔄', size: 'xxl', flex: 0 },
          { type: 'box', layout: 'vertical', flex: 1, margin: 'lg', contents: [
            { type: 'text', text: 'งานต้องแก้ไข!', color: '#FFFFFF', size: 'lg', weight: 'bold' },
            { type: 'text', text: `รหัส ${taskId} | จาก ${assignerName}`, color: '#FFFFFF99', size: 'xs' }
          ]}
        ]
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px',
        contents: [
          { type: 'text', text: taskMessage, size: 'md', color: '#333333', wrap: true, weight: 'bold' },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: '📝 เหตุผลที่ต้องแก้ไข', size: 'xs', color: '#AAAAAA', margin: 'lg' },
          { type: 'box', layout: 'vertical', backgroundColor: '#FFEBEE', paddingAll: '12px', cornerRadius: '8px', margin: 'sm', contents: [
            { type: 'text', text: reason, size: 'sm', color: '#C62828', wrap: true, weight: 'bold' }
          ]},
          { type: 'box', layout: 'vertical', margin: 'lg', backgroundColor: '#FFF3E0', paddingAll: '10px', cornerRadius: '8px', contents: [
            { type: 'text', text: '💪 แก้ไขแล้วส่งใหม่ได้เลย!', size: 'sm', color: '#FF8C00', align: 'center', weight: 'bold' }
          ]}
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '15px',
        contents: [
          { type: 'button', action: { type: 'message', label: `📨 ส่งงานใหม่`, text: `#ส่งงาน ${taskId} ` }, style: 'primary', color: '#FF8C00', height: 'sm' }
        ]
      },
      styles: { footer: { separator: true } }
    }
  };
}

// Health check endpoint
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (dashboard)
const path = require('path');
app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ดึงข้อมูลงานทั้งหมดในกลุ่ม (สำหรับ debug)
app.get('/api/tasks/:groupId', async (req, res) => {
  try {
    const tasks = await TaskDB.getAllTasksInGroup(req.params.groupId);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// ═══ Dashboard API Endpoints ═══
// ═══════════════════════════════════════════

// CORS for dashboard
app.use('/api/dashboard', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ดึงรายชื่อกลุ่มทั้งหมด (จากทั้ง group_members และ tasks)
app.get('/api/dashboard/groups', async (req, res) => {
  try {
    const groups = await queryAll(
      `SELECT DISTINCT group_id FROM tasks
       UNION
       SELECT DISTINCT group_id FROM group_members`
    );
    const result = [];
    for (const g of groups) {
      const memberCount = await queryOne(
        `SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ?`, [g.group_id]
      );
      const taskCount = await queryOne(
        `SELECT COUNT(*) as cnt FROM tasks WHERE group_id = ?`, [g.group_id]
      );
      result.push({
        group_id: g.group_id,
        members: memberCount?.cnt || 0,
        tasks: taskCount?.cnt || 0
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// สรุปภาพรวม (stats) ของกลุ่ม
app.get('/api/dashboard/stats/:groupId', async (req, res) => {
  try {
    const gid = req.params.groupId;
    const [total, pending, accepted, submitted, completed, members] = await Promise.all([
      queryOne(`SELECT COUNT(*) as cnt FROM tasks WHERE group_id = ?`, [gid]),
      queryOne(`SELECT COUNT(*) as cnt FROM tasks WHERE group_id = ? AND status = 'pending'`, [gid]),
      queryOne(`SELECT COUNT(*) as cnt FROM tasks WHERE group_id = ? AND status = 'accepted'`, [gid]),
      queryOne(`SELECT COUNT(*) as cnt FROM tasks WHERE group_id = ? AND status = 'submitted'`, [gid]),
      queryOne(`SELECT COUNT(*) as cnt FROM tasks WHERE group_id = ? AND status = 'completed'`, [gid]),
      queryOne(`SELECT COUNT(*) as cnt FROM group_members WHERE group_id = ?`, [gid])
    ]);
    res.json({
      total_tasks: total?.cnt || 0,
      pending: pending?.cnt || 0,
      accepted: accepted?.cnt || 0,
      submitted: submitted?.cnt || 0,
      completed: completed?.cnt || 0,
      members: members?.cnt || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// อันดับ + แต้มสะสม
app.get('/api/dashboard/leaderboard/:groupId', async (req, res) => {
  try {
    const leaders = await TaskDB.getLeaderboard(req.params.groupId);
    res.json(leaders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// งานทั้งหมด (พร้อม filter)
app.get('/api/dashboard/tasks/:groupId', async (req, res) => {
  try {
    const gid = req.params.groupId;
    const status = req.query.status;
    let sql = `SELECT * FROM tasks WHERE group_id = ?`;
    let params = [gid];
    if (status && status !== 'all') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    const tasks = await queryAll(sql, params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// สมาชิกในกลุ่ม
app.get('/api/dashboard/members/:groupId', async (req, res) => {
  try {
    const members = await TaskDB.getGroupMembers(req.params.groupId);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// กิจกรรมล่าสุด (recent activity = tasks + points log)
app.get('/api/dashboard/activity/:groupId', async (req, res) => {
  try {
    const gid = req.params.groupId;
    const tasks = await queryAll(
      `SELECT task_id, assigner_name, assignee_name, message, status, created_at, accepted_at, replied_at, updated_at FROM tasks WHERE group_id = ? ORDER BY updated_at DESC LIMIT 20`,
      [gid]
    );
    const pointsLog = await queryAll(
      `SELECT pl.*, p.display_name FROM points_log pl LEFT JOIN points p ON pl.user_id = p.user_id AND pl.group_id = p.group_id WHERE pl.group_id = ? ORDER BY pl.created_at DESC LIMIT 20`,
      [gid]
    );
    res.json({ tasks, pointsLog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ระบบทวงงานอัตโนมัติ =====
// ตรวจสอบทุก 5 นาที ว่ามีงานเลยกำหนดไหม
setInterval(async () => {
  try {
    const overdueTasks = await TaskDB.getOverdueTasks();
    
    for (const task of overdueTasks) {
      console.log(`⏰ Overdue task found: ${task.task_id} - ${task.message}`);
      
      // ส่ง DM ทวงงานไปหาผู้รับงาน
      try {
        const flexMsg = buildFlexOverdueReminder(task.task_id, task.assignee_name, task.message, formatDeadline(task.deadline));
        const dmSent = await sendDM(task.assignee_id, [flexMsg]);

        if (!dmSent) {
          // ถ้า DM ไม่ได้ → ส่งในกลุ่ปแทน
          const mentionMsg = {
            type: 'textV2',
            text: `⚠️ {assignee} งานรหัส ${task.task_id} เลยกำหนดแล้ว! กรุณาส่งงานด้วยครับ`,
            substitution: {
              assignee: { type: 'mention', mentionee: { type: 'user', userId: task.assignee_id } }
            }
          };
          await client.pushMessage({
            to: task.group_id,
            messages: [flexMsg, mentionMsg]
          });
        }
        
        // บันทึกว่าส่ง reminder แล้ว
        await TaskDB.markReminderSent(task.task_id);
        console.log(`✅ Reminder sent for task ${task.task_id}`);
      } catch (err) {
        console.error(`Error sending reminder for task ${task.task_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error checking overdue tasks:', err);
  }
}, 5 * 60 * 1000); // ทุก 5 นาที

console.log('⏰ Auto-reminder system started (checks every 5 minutes)');

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Webhook URL: http://your-domain.com/webhook`);
});
