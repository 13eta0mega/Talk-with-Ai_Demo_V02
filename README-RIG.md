# 미리보기와 편집 · pose-motion-10

`preview.html`에서 21개 표정과 22개 몸동작을 선택하세요. 얼굴·몸 채널은 독립적이며 감정에 맞는 몸동작을 함께 재생할 수 있습니다.

- 왼쪽/오른쪽 볼을 누르거나 각각의 찌르기 버튼을 누르면 그쪽을 바라보고 볼을 부풀린 뒤 기존 표정과 시선으로 복귀합니다. 좌우는 화면 기준입니다.
- 쓰담쓰담은 앞머리 위로 장갑을 내렸습니다. 머리카락을 가로로 쓸면 감은 눈·홍조·위로 사라지는 하트가 나타납니다.
- 행복·기쁨의 노란 막대 표시는 껐습니다. 별도 웃음 표현의 표시는 유지합니다.
- 수줍음의 좌우 흔들림과 수줍음·사랑의 꼬리 움직임을 보정했습니다. 놀람 꼬리는 곧게 펴고, 슬픔 꼬리는 본으로 내린 뒤 끝만 조금 휘게 합니다.
- 윙크·인사에서는 공룡 파우치가 인사하는 팔보다 앞에 보입니다. 다른 손 모으기/들기 동작은 후드·가방 앞 레이어를 유지합니다.
- 별눈·하트눈은 테두리 없이 둥근 곡선으로 바꿨습니다.
- 우쭐대기·호기심·삐침을 추가했습니다. 숨과 어깨, 먼저 움직이는 시선과 뒤따르는 고개, 작게 도리도리하는 본 동작을 각각 사용합니다.
- 얼굴·몸 전환은 현재 위치와 속도를 이어받고, 파츠 교체는 가중치 페이드로 연결합니다. 움직임 줄이기·정지·초기화도 지원합니다.
- 립싱크는 21개 감정에서 데모/로컬 오디오/마이크로 사용할 수 있습니다. 음량 기반이며 자동 음소 인식은 아닙니다. 마이크는 사용자 버튼과 브라우저 권한이 필요합니다.

이번 보정에서는 팔을 들거나 허리에 얹었을 때의 겨드랑이 절단선을 제거했습니다. 기쁨·화남·결의는 발을 넓게 딛고 수줍음·사랑·슬픔은 모읍니다. 본 길이는 유지하고 양말 메쉬와 신발 본이 같은 발목을 공유합니다. 넓은 원본 신발의 모양을 보존하므로 모으기 범위는 신발이 겹치지 않게 제한했습니다.

몸동작 아래의 ‘발 간격’과 ‘발 들기’ 슬라이더로 직접 조절할 수 있습니다. 다른 감정/몸동작을 고르면 해당 동작의 다리 설정으로 돌아갑니다. ‘안도’는 표시 이름을 ‘우쭐대기’로 바꿨고 기존 저장 데이터 호환을 위해 API ID `relieved`는 유지했습니다.

```js
mintRig.setEmotion('curious', 1, .58);
mintRig.setAction('look-around', 1, .8);
mintRig.playInteraction('poke', 'left'); // 또는 'right'
mintRig.playInteraction('pet');
mintRig.stopInteraction();
mintRig.setBodyParameter('Stance', .85, .4); // -1 모으기 ~ 1 벌리기
mintRig.setBodyParameter('FootStep', 1.2, .4); // 0~5 발 들기
mintRig.setLipSync(.7, 'A');
mintRig.stopLipSync();
mintRig.reset({canonical:true});
```

소스 수정 후 `python src/build-preview.py`로 단일 파일 미리보기를 빌드합니다. 팔은 `parts/limb-variants.svg`, 장갑은 `parts/interaction-hands.svg`, 교감 애니메이션은 `src/interactions.js`, 꼬리 본과 메쉬는 `src/rig-runtime.js`에서 편집합니다. 렌더는 순수 SVG이며 생성 PNG는 참고용입니다.

승인된 `character.master.svg`는 변경하지 않았습니다. 작업 전 백업은 작업 폴더의 `backups/before-pose10.zip`입니다. 최신 전달 ZIP은 `character.pose-motion.package.zip`, 검증은 `qa/QA_REPORT.md`, 영상 분석은 `qa/pose10/reference-study.md`입니다. 다른 버전의 ZIP과 QA는 과거 기록입니다.
