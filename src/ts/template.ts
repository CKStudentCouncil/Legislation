export function meetingRecordTemplate() {
  return `<div><font size="3">一、開會時間：中華民國年月日星期 12時20分</font></div>
<div><font size="3">二、出席狀況：</font></div>
<div><font size="3">1. 出席：</font></div><div><font size="3">2. 請假：</font></div><div><font size="3">3. 缺席：</font></div>
<div><font size="3">三、議案以及決議</font></div><div><font size="3">(一) 議案順序：</font></div>
<div><font size="3">1. ___案</font></div><div><font size="3">2. ___案</font></div><div><font size="3">3. ___案</font></div>
<div><font size="3">(二) 議案決議(記名表決 絕對多數決)</font></div><div><font size="3">1. ___案</font></div>
<div><font size="3">班代：</font></div>
<div><font size="3">答：</font></div>
<div><font size="3">(1) ___</font></div>
<div><font size="3">同意：</font></div><div><font size="3">不同意：</font></div><div><font size="3">表決結果：</font></div>
`;
}

export function meetingNoticeTemplate() {
  const date = new Date();
  return `<div>一、___案</div><div>二、___案</div><div>開會時間：中華民國${date.getFullYear() - 1911}年${date.getMonth()+1}月日（星期）中午12時20分</div><div>開會地點：夢紅樓五樓 公民審議論壇教室</div><div>主持人：議長</div><div><br></div><div>備註：</div><div>一、請尚未加入本期間班級代表LINE社群的班代盡快加入，以便聯繫及接收最新開會資訊。</div><div>二、班代大會為本校重要學生自治機關，請各位班級代表務必出席，不勝感激。不克出席者請請假或由同班同學代理。</div><div>三、任何會議資料及會議相關事宜的更動皆會發布在本會社群。</div>`
}
