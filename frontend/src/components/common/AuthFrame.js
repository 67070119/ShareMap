import Link from 'next/link';
import NavIcon from './NavIcon';

/** Shared, presentation-only structure for login and registration.
 * Auth business logic stays in the page form components.
 */
const CONTENT = {
  login: {
    eyebrow: 'EVERY GIFT MATTERS',
    title: 'การแบ่งปัน เริ่มต้นจากที่ใกล้คุณ',
    description: 'พื้นที่เล็ก ๆ สำหรับเชื่อมคนที่อยากส่งต่อสิ่งของ กับคนที่กำลังมองหาสิ่งนั้น',
    foot: 'เข้าสู่ระบบแล้วเริ่มแบ่งปันได้ทันที',
  },
  register: {
    eyebrow: 'BE PART OF THE COMMUNITY',
    title: 'ของที่ไม่ใช้แล้ว อาจมีค่าสำหรับใครอีกคน',
    description: 'สร้างบัญชีเพื่อเพิ่มจุดบริจาค ค้นหาของใกล้ตัว และร่วมดูแลชุมชนให้ปลอดภัยขึ้น',
    foot: 'เริ่มต้นบัญชีใหม่ด้วยข้อมูลเพียงไม่กี่อย่าง',
  },
};

export default function AuthFrame({ mode, children }) {
  const content = CONTENT[mode] || CONTENT.login;
  return (
    <main className={`authShell authExperience authExperience--${mode}`}>
      <section className="authVisual" aria-label="เกี่ยวกับชุมชน OGTB">
        <div className="authVisualTop">
          <span className="authHeroIcon"><NavIcon name="gift" size={23}/></span>
          <span className="authHeroBrand">OGTB COMMUNITY</span>
        </div>
        <div className="authHeroScene" aria-hidden="true">
          <span className="authSceneGlow authSceneGlow--one"/>
          <span className="authSceneGlow authSceneGlow--two"/>
          <span className="authScenePath authScenePath--one"/>
          <span className="authScenePath authScenePath--two"/>
          <span className="authScenePin authScenePin--one"><NavIcon name="gift" size={20}/></span>
          <span className="authScenePin authScenePin--two"><NavIcon name="map" size={18}/></span>
          <span className="authScenePin authScenePin--three"><NavIcon name="users" size={19}/></span>
          <span className="authSceneCenter"><NavIcon name="gift" size={38}/></span>
          <span className="authSceneTag"><span className="authSceneTagDot"/>SHARE THE GOOD</span>
        </div>
        <div className="authHeroCopy">
          <span className="authHeroEyebrow">{content.eyebrow}</span>
          <h2>{content.title}</h2>
          <p>{content.description}</p>
          <div className="authHeroBenefits" aria-label="สิ่งที่ทำได้ใน OGTB">
            <span><NavIcon name="map" size={17}/>ค้นหาบนแผนที่</span>
            <span><NavIcon name="gift" size={17}/>เพิ่มจุดบริจาค</span>
            <span><NavIcon name="reports" size={17}/>รายงานปัญหา</span>
          </div>
        </div>
        <div className="authHeroFooter">
          <span>OGTB DONATION MAP</span>
          <span>MADE FOR SHARING <span aria-hidden="true">✦</span></span>
        </div>
      </section>

      <section className="authPanel">
        <div className="authMobileIntro">
          <span className="authMobileIntroIcon"><NavIcon name="gift" size={19}/></span>
          <div><strong>พื้นที่แบ่งปันของคนในชุมชน</strong><small>{content.foot}</small></div>
        </div>
        {children}
        <Link href="/" className="authBackToMap"><NavIcon name="map" size={17}/>กลับไปสำรวจแผนที่</Link>
        <p className="authPanelFootnote">OGTB Donation Map · แบ่งปันได้ในทุกวัน</p>
      </section>
    </main>
  );
}
