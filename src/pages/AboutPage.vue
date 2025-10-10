<template>
  <q-page padding>
    <q-img v-if="$q.dark.isActive" src="https://raw.githubusercontent.com/CKStudentCouncil/Legislation/refs/heads/main/mail/images/_1d.png" />
    <q-img v-else src="https://raw.githubusercontent.com/CKStudentCouncil/Legislation/refs/heads/main/mail/images/_1.png" />
    <div class="q-pb-xs">
      本法律與公文系統是由建國中學班級代表大會79屆下議長李沐恩所製，致力於電子化班聯會的法律文件以及公文流通，提供一個統一、公開的查詢平台供班聯會全體會員以及各界檢視，讓班聯會的行政以及班代大會的議事更加透明化。
    </div>
    <div class="q-pb-xs">然此系統仍於開發階段，尚有不足之處，希望各界能提供意見與建議，以利系統之改進。</div>
    <div class="q-pb-xs">若有友校之學生自治機關有意使用此系統，歡迎與作者聯絡，將會提供一個獨立的系統與其使用與管理權限。</div>
    <div class="q-pb-xs">
      系統公開原始碼，歡迎給個 Star：<a href="https://github.com/CKStudentCouncil/Legislation" target="_blank"
        >https://github.com/CKStudentCouncil/Legislation</a
      >
    </div>
    <div class="q-pb-xs">聯絡方式：<a href="mailto:cksc77th@gmail.com">cksc77th@gmail.com</a></div>
    <div class="q-pb-xs">使用本系統檢視、編輯、發布本校班聯會公文、法律者，須同意以下使用者條款：</div>
    <br />
    <div class="text-h4 text-center">臺北市立建國高級中學班聯會法律與公文系統使用者條款</div>
    <p>
      歡迎您使用臺北市立建國高級中學班聯會法律與公文系統（以下簡稱「本系統」）。為保障使用者權益並維護系統運作秩序，請您在使用本系統前，詳閱以下使用者條款。當您使用本系統，即表示您已閱讀、瞭解並同意遵守本條款之所有內容。
    </p>

    <section>
      <div class="text-h6">一、智慧財產權與授權</div>
      <ul>
        <li>
          您上傳、傳送、輸入或提供至本系統之任何資料（以下簡稱「使用者內容」），若為您原創，您同意以「創用 CC 姓名標示-相同方式分享（CC
          BY-SA）」授權本系統及其他使用者使用、修改、重製、散布、發行及公開展示該內容。
        </li>
        <li>
          您保證對所提供之使用者內容擁有完整著作權或合法授權，並有權依本條款進行授權。若因您未具授權權利而導致任何第三人主張權利，您應自行負責，並賠償本系統因此所受之一切損害。
        </li>
        <li>若您無上述合法授權，請勿上傳、傳送、輸入或提供該資料至本系統。</li>
      </ul>
    </section>

    <section>
      <div class="text-h6">二、個人資料保護</div>
      <ul>
        <li>
          本系統可能蒐集、處理、利用您於使用過程中提供之個人資料（如姓名、電子郵件帳號、班級、座號、學號、IP
          位址等），惟僅用於系統管理、使用者識別與功能提供，不會用於其他未經授權之用途。
        </li>
        <li>您有權就您所提供之個人資料，依《個人資料保護法》行使查詢、閱覽、補充、更正、停止蒐集、處理或使用及刪除等權利，請聯繫系統管理員辦理。</li>
        <li>本系統將採取合理技術與資安管理措施，保護您的個人資料安全，防止未經授權之存取、洩漏或竄改。</li>
        <li>如有第三人以不法手段未經授權存取、洩漏或竄改您的個人資料，本系統不負任何責任，使用者應自行向第三人究責。</li>
      </ul>
    </section>

    <section>
      <div class="text-h6">三、使用者責任</div>
      <ul>
        <li>您應保證所提供之使用者內容不違反中華民國法律、臺北市立建國高級中學學生獎懲規定及臺北市立建國高級中學班聯會內法。</li>
        <li>
          您不得利用本系統從事任何違法、不當或侵害他人權益之行為，包括但不限於散布不實資訊、侵害隱私（請尤其注意於公文中公開之姓名等個資，應事先獲得當事人之法定代理人或本人同意，方可公開全名，否則應以適當之措施遮掩其名）、散播惡意程式等。
        </li>
        <li>若您違反本條款任一項，本系統有權立即停止您的使用權限，您並應自行承擔一切法律責任，並賠償本系統及第三人因此所受之損害。</li>
      </ul>
    </section>

    <section>
      <div class="text-h6">四、平台責任免除與內容管理</div>
      <ul>
        <li>本系統為開放性平台，對使用者內容不負預審義務，亦不保證其正確性、完整性或合法性。</li>
        <li>對於任何因使用者提供之內容所生錯誤、遺漏、違法事項或損害，本系統不負任何責任。</li>
        <li>本系統保留隨時審查、移除、限制或封鎖任何違反本條款或相關法規之內容或帳號之權利，無須事先通知。</li>
      </ul>
    </section>

    <section>
      <div class="text-h6">五、條款修改</div>
      <ul>
        <li>本系統有權隨時修改本使用者條款，並將更新內容公告於系統，標註最後更新日期。</li>
        <li>條款更新後，您繼續使用本系統即視為同意更新內容。如您不同意修改內容，請立即停止使用本系統。</li>
      </ul>
    </section>

    <section>
      <div class="text-h6">六、準據法與管轄法院</div>
      <ul>
        <li>本條款之解釋與適用，悉依中華民國法律為準據法。</li>
        <li>因本條款或使用本系統所生之任何爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。</li>
      </ul>
    </section>

    <footer>📌 最後更新日期：2025年10月10日</footer>
  </q-page>
</template>

<script lang="ts" setup>
import { useMeta } from 'quasar';
import { getMeta } from 'src/ts/utils.ts';

useMeta({ title: '關於與使用條款', meta: getMeta('關於與使用條款') });
</script>

<style scoped></style>
