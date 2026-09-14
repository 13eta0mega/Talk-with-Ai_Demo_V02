# 미리보기와 편집 · pose-motion-15

`preview.html`에서 22개 표정과 23개 몸동작을 선택하세요.

- 갸우뚱은 3~7초 난수 간격으로 좌·우·정면을 연결합니다.
- 호기심은 2~5초 난수 간격으로 좌·우·정면을 보고, 가끔 위와 아래도 봅니다.
- 눈치는 양 검지 간격과 함께 팔 본도 작게 움직여 손끝만 늘어나는 인상을 줄였습니다.
- 볼 당기기는 볼을 누른 뒤 바깥쪽으로 42px 이상 드래그해야 시작합니다. 방향 벡터와 거리에 따라 얼굴 외곽, 가까운 눈, 입꼬리, 턱, 옆머리의 가중 FFD가 함께 움직입니다.
- 강도 0.62부터 닫힌 눈 브리지로 이어지고 0.78 이후에는 단일 불투명 찡그린 눈 경로가 연속 morph합니다. 기존 눈과 교체 눈을 동시에 표시하지 않습니다.
- 쓰담쓰담·찌르기·볼 당기기의 접촉 위치에는 분홍색 고양이 발바닥 커서가 표시됩니다.
- `터치·포인터 따라보기 · 눈`과 `터치·포인터 따라가기 · 자세`를 따로 켜고 끌 수 있습니다. 자세 추적은 좌우·상하 HeadYaw/HeadPitch와 몸 기울기를 함께 제어합니다.
- 쓰담쓰담·찌르기·볼 당기기는 포인터를 놓은 뒤 0.24초에 복귀합니다.
- 후드 벗기는 감정 전환 뒤에도 유지되는 토글이며, 기존 앞머리 실루엣과 아이보리 뒷머리를 그대로 사용합니다.
- 홍채·동공·광택은 하나의 강체 묶음으로 이동합니다. 얼굴·눈·앞머리·후드 장식은 서로 다른 이동량과 감쇠 속도로 제한된 2.5D 깊이를 만듭니다.
- 화면 밖에서 들어온 포인터 시선은 0.48초 응답으로 완만하게 합류합니다. 놀람 꼬리는 길이 증가를 억제한 채 펴집니다.

```js
mintRig.setEmotion('cautious',1,.58);
mintRig.setAction('cautious',1,.8);
mintRig.playInteraction('pull','left'); // right도 가능
mintRig.directInteraction('pull','left',.65); // 포인터 거리 기반 0..1
mintRig.directCheekPull('left',.65,-120,18); // 강도 + 로컬 drag vector
mintRig.stopInteraction(.24);
mintRig.setPoseTracking(true);
mintRig.setParameter('HoodOff',1,1.3);
mintRig.setParameter('HeadYaw',-.8,.65);
```

소스 변경 후 `python src/build-preview.py`로 단일 파일 미리보기를 빌드합니다. 리깅은 `src/rig-runtime.js`, 머리 방향·후드 동작은 `src/pose-performance.js`, 교감은 `src/interactions.js`에서 편집합니다. 승인된 마스터는 보존했습니다.
