import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import type { BaseLang } from '../../core/types'
import { useT } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, space } from '../../theme/tokens'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'

/**
 * Privacy policy and terms of use, in the learner's language.
 *
 * The text describes what the code actually does (see server/src and src/lib).
 * It is NOT legal advice: before a store release the owner must review it, add
 * the legal name of the publisher and a contact address in LEGAL_CONTACT, and
 * keep it in step with the product.
 */
export const LEGAL_CONTACT = ''
const UPDATED = '2026-09-21'

export type LegalKind = 'privacy' | 'terms'

interface Section {
  title: string
  body: string
}

interface Doc {
  title: string
  updated: string
  contact: string
  sections: Section[]
}

const PRIVACY: Record<BaseLang, Doc> = {
  uz: {
    title: 'Maxfiylik siyosati',
    updated: 'Oxirgi yangilanish',
    contact: 'Aloqa',
    sections: [
      { title: 'Akkauntsiz foydalanish', body: "Ilovadan akkauntsiz, mehmon sifatida foydalanish mumkin. Bu holda o'qish natijalaringiz faqat shu qurilmada saqlanadi va bizning serverimizga yuborilmaydi." },
      { title: 'Akkaunt ochganingizda nimalar saqlanadi', body: "Email manzilingiz (yoki Telegram orqali kirgan bo'lsangiz, Telegram ID raqamingiz va ismingiz), parolingizning qaytarib bo'lmaydigan xeshi (parolning o'zi saqlanmaydi), ilovadagi ismingiz va tanlagan yo'lboshchingiz, o'qish natijalaringiz (tugatilgan darslar, XP, seriya, so'zlarni takrorlash jadvali) hamda haftalik ligadagi XP. Ligada boshqa o'quvchilarga faqat ismingiz, yo'lboshchingiz va XP ko'rinadi." },
      { title: 'AI bilan suhbat', body: "AI yo'lboshchi bilan suhbatda yozgan xabarlaringiz serverimizga yuboriladi va javob tayyorlash uchun Anthropic kompaniyasining Claude modeliga uzatiladi. Biz suhbat matnini serverda saqlamaymiz; faqat kunlik xabarlar soni hisoblanadi. AI bergan tuzatishlar o'qish natijalaringiz ichida saqlanadi, shunda keyingi mashqlar aynan shu xatolarga qaratiladi. Suhbatda shaxsiy ma'lumotlaringizni (manzil, hujjat raqamlari, to'lov ma'lumotlari) yozmang." },
      { title: 'Ovoz', body: "Gapirish mashqlarida nutqni tanish brauzeringiz yoki telefoningizning o'z xizmati orqali bajariladi. Biz ovoz yozuvlarini olmaymiz va saqlamaymiz; ilovaga faqat tanilgan matn keladi." },
      { title: 'Eslatmalar', body: "Telefondagi eslatmalar qurilmaning o'zida rejalashtiriladi. Telegram orqali eslatmani yoqsangiz, bot siz tanlagan soatda sizga xabar yuboradi; buni Profil bo'limida istalgan payt o'chirishingiz mumkin." },
      { title: 'Nimalarni qilmaymiz', body: "Ilovada reklama yo'q. Ma'lumotlaringizni sotmaymiz va reklama tarmoqlariga bermaymiz. Uchinchi tomon kuzatuv (tracking) vositalaridan foydalanmaymiz." },
      { title: "Ma'lumotlarni o'chirish", body: "Profil → «Akkauntni o'chirish» tugmasi akkauntingizni va serverdagi barcha ma'lumotlaringizni (natijalar, liga tarixi, sessiyalar) darhol o'chiradi. Profil → «Natijalarni o'chirish» qurilmadagi natijalarni o'chiradi." },
    ],
  },
  ru: {
    title: 'Политика конфиденциальности',
    updated: 'Последнее обновление',
    contact: 'Контакт',
    sections: [
      { title: 'Использование без аккаунта', body: 'Приложением можно пользоваться без аккаунта, как гость. В этом случае ваш прогресс хранится только на этом устройстве и не отправляется на наш сервер.' },
      { title: 'Что хранится, когда вы создаёте аккаунт', body: 'Ваш email (или, если вы вошли через Telegram, ваш Telegram ID и имя), необратимый хеш пароля (сам пароль не хранится), имя в приложении и выбранный проводник, ваш прогресс (пройденные уроки, XP, серия, расписание повторения слов) и XP в недельной лиге. В лиге другим ученикам видны только ваше имя, проводник и XP.' },
      { title: 'Разговор с AI', body: 'Сообщения, которые вы пишете AI-проводнику, отправляются на наш сервер и передаются модели Claude компании Anthropic, чтобы подготовить ответ. Мы не храним текст разговоров на сервере; считается только число сообщений в день. Исправления от AI сохраняются в вашем прогрессе, чтобы следующие упражнения были направлены именно на эти ошибки. Не пишите в разговоре личные данные (адрес, номера документов, платёжные данные).' },
      { title: 'Голос', body: 'В упражнениях на речь распознавание выполняет служба вашего браузера или телефона. Мы не получаем и не храним аудиозаписи; в приложение приходит только распознанный текст.' },
      { title: 'Напоминания', body: 'Напоминания на телефоне планируются на самом устройстве. Если вы включите напоминание через Telegram, бот напишет вам в выбранный час; это можно отключить в любой момент в разделе «Профиль».' },
      { title: 'Чего мы не делаем', body: 'В приложении нет рекламы. Мы не продаём ваши данные и не передаём их рекламным сетям. Мы не используем сторонние средства отслеживания.' },
      { title: 'Удаление данных', body: 'Профиль → «Удалить аккаунт» сразу удаляет ваш аккаунт и все ваши данные на сервере (прогресс, историю лиги, сессии). Профиль → «Сбросить прогресс» удаляет прогресс на устройстве.' },
    ],
  },
  tr: {
    title: 'Gizlilik politikası',
    updated: 'Son güncelleme',
    contact: 'İletişim',
    sections: [
      { title: 'Hesapsız kullanım', body: 'Uygulamayı hesap açmadan, misafir olarak kullanabilirsin. Bu durumda ilerlemen yalnızca bu cihazda saklanır ve sunucumuza gönderilmez.' },
      { title: 'Hesap açtığında neler saklanır', body: 'E-posta adresin (ya da Telegram ile giriş yaptıysan Telegram kimlik numaran ve adın), parolanın geri döndürülemez özeti (parolanın kendisi saklanmaz), uygulamadaki adın ve seçtiğin rehber, ilerlemen (tamamlanan dersler, XP, seri, kelime tekrar takvimi) ve haftalık ligdeki XP. Ligde diğer öğrenciler yalnızca adını, rehberini ve XP değerini görür.' },
      { title: 'AI ile sohbet', body: "AI rehberine yazdığın mesajlar sunucumuza gönderilir ve cevabın hazırlanması için Anthropic şirketinin Claude modeline iletilir. Sohbet metnini sunucuda saklamıyoruz; yalnızca günlük mesaj sayısı tutulur. AI'ın düzeltmeleri ilerlemenin içinde saklanır; böylece sonraki alıştırmalar tam bu hatalara yönelir. Sohbete kişisel bilgilerini (adres, belge numaraları, ödeme bilgileri) yazma." },
      { title: 'Ses', body: 'Konuşma alıştırmalarında ses tanıma, tarayıcının ya da telefonunun kendi hizmetiyle yapılır. Ses kayıtlarını almıyor ve saklamıyoruz; uygulamaya yalnızca tanınan metin gelir.' },
      { title: 'Hatırlatmalar', body: "Telefondaki hatırlatmalar cihazın kendisinde planlanır. Telegram hatırlatmasını açarsan bot sana seçtiğin saatte yazar; bunu Profil bölümünden istediğin zaman kapatabilirsin." },
      { title: 'Yapmadıklarımız', body: 'Uygulamada reklam yok. Verilerini satmıyoruz ve reklam ağlarıyla paylaşmıyoruz. Üçüncü taraf izleme araçları kullanmıyoruz.' },
      { title: 'Verilerin silinmesi', body: 'Profil → «Hesabı sil» hesabını ve sunucudaki bütün verilerini (ilerleme, lig geçmişi, oturumlar) hemen siler. Profil → «İlerlemeyi sıfırla» cihazdaki ilerlemeyi siler.' },
    ],
  },
}

const TERMS: Record<BaseLang, Doc> = {
  uz: {
    title: 'Foydalanish shartlari',
    updated: 'Oxirgi yangilanish',
    contact: 'Aloqa',
    sections: [
      { title: 'Xizmat', body: "Aytla ingliz tilini o'rganish uchun ilova. Undan shaxsiy, notijorat maqsadda foydalanishingiz mumkin." },
      { title: 'Akkauntingiz', body: "Parolingizni hech kimga bermang. Akkauntingiz orqali qilingan harakatlar uchun o'zingiz javobgarsiz. Akkauntni istalgan payt Profil bo'limida o'chirishingiz mumkin." },
      { title: 'AI xato qilishi mumkin', body: "AI yo'lboshchining javoblari va tuzatishlari sun'iy intellekt tomonidan yaratiladi va ba'zan noto'g'ri bo'lishi mumkin. Ularga o'quv yordami sifatida qarang. Muhim qarorlarni (imtihon, hujjat, ish) faqat AI javobiga tayanib qabul qilmang." },
      { title: 'Halol foydalanish', body: "Xizmatni buzishga, boshqalarning akkauntiga kirishga, ligada natijalarni soxtalashtirishga yoki AI suhbatidan haqoratli va noqonuniy maqsadlarda foydalanishga urinmang. Bunday hollarda akkaunt cheklanishi mumkin." },
      { title: "Kafolat yo'q", body: "Xizmat «boricha» taqdim etiladi. Biz uni yaxshilab boramiz, lekin uzluksiz ishlashiga yoki muayyan natijaga (masalan, imtihon balliga) kafolat bermaymiz." },
      { title: "O'zgarishlar", body: "Bu shartlar yangilanishi mumkin. Muhim o'zgarishlar haqida ilova ichida xabar beramiz." },
    ],
  },
  ru: {
    title: 'Условия использования',
    updated: 'Последнее обновление',
    contact: 'Контакт',
    sections: [
      { title: 'Сервис', body: 'Aytla — приложение для изучения английского языка. Вы можете пользоваться им в личных, некоммерческих целях.' },
      { title: 'Ваш аккаунт', body: 'Никому не сообщайте свой пароль. Вы отвечаете за действия, совершённые через ваш аккаунт. Аккаунт можно удалить в любой момент в разделе «Профиль».' },
      { title: 'AI может ошибаться', body: 'Ответы и исправления AI-проводника создаются искусственным интеллектом и иногда бывают неверными. Относитесь к ним как к учебной помощи. Не принимайте важных решений (экзамен, документы, работа), опираясь только на ответ AI.' },
      { title: 'Честное использование', body: 'Не пытайтесь нарушить работу сервиса, войти в чужой аккаунт, подделать результаты в лиге или использовать разговор с AI в оскорбительных и незаконных целях. В таких случаях аккаунт может быть ограничен.' },
      { title: 'Без гарантий', body: 'Сервис предоставляется «как есть». Мы его улучшаем, но не гарантируем бесперебойной работы или определённого результата (например, балла на экзамене).' },
      { title: 'Изменения', body: 'Эти условия могут обновляться. О важных изменениях мы сообщим в приложении.' },
    ],
  },
  tr: {
    title: 'Kullanım koşulları',
    updated: 'Son güncelleme',
    contact: 'İletişim',
    sections: [
      { title: 'Hizmet', body: 'Aytla, İngilizce öğrenmek için bir uygulamadır. Onu kişisel, ticari olmayan amaçlarla kullanabilirsin.' },
      { title: 'Hesabın', body: 'Parolanı kimseyle paylaşma. Hesabın üzerinden yapılan işlemlerden sen sorumlusun. Hesabını istediğin zaman Profil bölümünden silebilirsin.' },
      { title: 'AI hata yapabilir', body: "AI rehberinin cevapları ve düzeltmeleri yapay zekâ tarafından üretilir ve bazen yanlış olabilir. Onları bir öğrenme yardımı olarak gör. Önemli kararları (sınav, belge, iş) yalnızca AI'ın cevabına dayanarak verme." },
      { title: 'Dürüst kullanım', body: 'Hizmeti bozmaya, başkalarının hesabına girmeye, ligde sonuçları sahte yollarla yükseltmeye ya da AI sohbetini hakaret içeren ve yasa dışı amaçlarla kullanmaya çalışma. Böyle durumlarda hesap kısıtlanabilir.' },
      { title: 'Garanti yok', body: 'Hizmet «olduğu gibi» sunulur. Onu geliştirmeye devam ediyoruz, ancak kesintisiz çalışacağını ya da belirli bir sonucu (örneğin bir sınav puanını) garanti etmiyoruz.' },
      { title: 'Değişiklikler', body: 'Bu koşullar güncellenebilir. Önemli değişiklikleri uygulama içinde duyururuz.' },
    ],
  },
}

export function LegalScreen({ kind }: { kind: LegalKind }) {
  const router = useRouter()
  const t = useT()
  const lang = useApp((s) => s.user.profile.baseLang)
  const doc = (kind === 'privacy' ? PRIVACY : TERMS)[lang]
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'))

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="arrow-back" size={28} color={colors.textMuted} />
        </Pressable>
        <Txt variant="title">{doc.title}</Txt>
        <Txt variant="caption" color={colors.textMuted}>
          {doc.updated}: {UPDATED}
        </Txt>
        {doc.sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <Txt variant="heading">{s.title}</Txt>
            <Txt color={colors.textSoft} style={styles.text}>
              {s.body}
            </Txt>
          </View>
        ))}
        {LEGAL_CONTACT ? (
          <View style={styles.section}>
            <Txt variant="heading">{doc.contact}</Txt>
            <Txt color={colors.textSoft} style={styles.text}>
              {LEGAL_CONTACT}
            </Txt>
          </View>
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, maxWidth: 760, width: '100%', alignSelf: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  section: { gap: space.xs, marginTop: space.sm },
  text: { fontSize: 16, lineHeight: 24 },
})
