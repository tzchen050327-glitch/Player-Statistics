    const INTERNATIONAL_COMPETITIONS = ['WBC', 'WBCQ', '世界12強', '亞洲運動會', 'U18亞青', '亞錦賽'];
    const INTERNATIONAL_TOURNAMENT_META = {
      'WBC': { code:'WBC', name:'世界棒球經典賽' },
      'WBCQ': { code:'WBCQ', name:'經典賽資格賽' },
      '世界12強': { code:'P12', name:'世界12強' },
      '亞洲運動會': { code:'AG', name:'亞洲運動會' },
      'U18亞青': { code:'BFAU18', name:'U18亞洲青棒錦標賽' },
      '亞錦賽': { code:'ABC', name:'亞洲棒球錦標賽' }
    };
    const INTERNATIONAL_TOURNAMENT_YEARS = {
      'WBC': [2026,2023,2017,2013,2009,2006],
      'WBCQ': [2025,2022,2016,2012],
      '世界12強': [2024,2019,2015],
      '亞洲運動會': [2026,2023,2018,2014,2010,2006,2002,1998,1994],
      'U18亞青': [2026],
      '亞錦賽': [2025,2023,2019,2017,2015,2012,2009,2007,2005,2003,2001]
    };
    const INTERNATIONAL_TEAM_NAME_MAP = {
      'Chinese Taipei':'中華台北','Chinese-Taipei':'中華台北','Taiwan':'中華台北','中華隊':'中華台北','TPE':'中華台北',
      'Japan':'日本','JPN':'日本','Korea':'韓國','South Korea':'韓國','KOR':'韓國',
      'United States':'美國','USA':'美國','Spain':'西班牙','ESP':'西班牙',
      'China':'中國','CHN':'中國','Hong Kong':'香港','HKG':'香港',
      'Philippines':'菲律賓','PHI':'菲律賓','Sri Lanka':'斯里蘭卡','SRI':'斯里蘭卡',
      'Singapore':'新加坡','SGP':'新加坡','Thailand':'泰國','THA':'泰國',
      'Pakistan':'巴基斯坦','PAK':'巴基斯坦','Palestine':'巴勒斯坦','PLE':'巴勒斯坦',
      'Laos':'寮國','LAO':'寮國','Indonesia':'印尼','INA':'印尼','Mongolia':'蒙古','MGL':'蒙古'
    };
    const INTERNATIONAL_TEAM_CATALOG = {
      'WBC:2026': ['中華台北','日本','韓國','澳洲','捷克','美國','墨西哥','義大利','英國','巴西','加拿大','哥倫比亞','古巴','巴拿馬','波多黎各','多明尼加','以色列','荷蘭','尼加拉瓜','委內瑞拉'],
      'WBC:2023': ['中華台北','日本','韓國','澳洲','中國','捷克','美國','墨西哥','哥倫比亞','加拿大','英國','古巴','多明尼加','以色列','義大利','荷蘭','尼加拉瓜','巴拿馬','波多黎各','委內瑞拉'],
      'WBC:2017': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','哥倫比亞','加拿大','古巴','多明尼加','以色列','義大利','荷蘭','波多黎各','委內瑞拉'],
      'WBC:2013': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','加拿大','古巴','多明尼加','義大利','荷蘭','波多黎各','西班牙','巴西','委內瑞拉'],
      'WBC:2009': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','加拿大','古巴','多明尼加','義大利','荷蘭','巴拿馬','波多黎各','南非','委內瑞拉'],
      'WBC:2006': ['中華台北','日本','韓國','澳洲','中國','美國','墨西哥','加拿大','古巴','多明尼加','義大利','荷蘭','巴拿馬','波多黎各','南非','委內瑞拉'],

      'WBCQ:2025': ['中華台北','西班牙','尼加拉瓜','南非','哥倫比亞','巴西','德國','中國'],
      'WBCQ:2022': ['捷克','德國','西班牙','英國','法國','南非','巴拿馬','尼加拉瓜','巴西','阿根廷','紐西蘭','巴基斯坦'],
      'WBCQ:2016': ['澳洲','紐西蘭','菲律賓','南非','墨西哥','捷克','德國','尼加拉瓜','巴拿馬','哥倫比亞','法國','西班牙','以色列','英國','巴西','巴基斯坦'],
      'WBCQ:2012': ['中華台北','紐西蘭','菲律賓','泰國','加拿大','德國','捷克','英國','巴西','巴拿馬','哥倫比亞','尼加拉瓜','西班牙','以色列','法國','南非'],

      '世界12強:2024': ['中華台北','日本','韓國','澳洲','古巴','多明尼加','墨西哥','荷蘭','巴拿馬','波多黎各','美國','委內瑞拉'],
      '世界12強:2019': ['中華台北','日本','韓國','澳洲','加拿大','古巴','多明尼加','墨西哥','荷蘭','波多黎各','美國','委內瑞拉'],
      '世界12強:2015': ['中華台北','日本','韓國','加拿大','古巴','多明尼加','義大利','墨西哥','荷蘭','波多黎各','美國','委內瑞拉'],

      'U18亞青:2026': ['日本','菲律賓','香港','斯里蘭卡','中華台北','韓國','泰國','新加坡'],
      '亞洲運動會:2026': ['日本','中國','菲律賓','巴勒斯坦','中華台北','韓國','香港','泰國'],
      '亞洲運動會:2023': ['日本','韓國','中華台北','中國','菲律賓','香港','泰國','寮國','新加坡'],
      '亞錦賽:2025': ['日本','中國','菲律賓','巴基斯坦','中華台北','韓國','香港','巴勒斯坦'],
      '亞錦賽:2023': ['日本','韓國','中華台北','泰國','菲律賓','巴基斯坦','巴勒斯坦','香港']
    };
    const OVERSEAS_LEAGUES = ['美國職棒', 'NPB', 'KBO', '其他海外聯盟'];    const PREFERRED_EXTERNAL_NAME_FIXES = {
      'KBO:52605': { name: '金倒永', aliases: ['金道英'] },
      'MLB:660271': { name: '大谷翔平', aliases: ['大谷'] },
      'MLB:808967': { name: '山本由伸', aliases: ['山本'] },
      'US:660271': { name: '大谷翔平', aliases: ['大谷'] },
      'US:808967': { name: '山本由伸', aliases: ['山本'] }
    };
    const PREFERRED_EXTERNAL_TEAM_FIXES = {
      'NPB:21925136': 'Fukuoka SoftBank Hawks',
      'NPB:33935152': 'Saitama Seibu Lions'
    };

    function applyStoredPreferredExternalName(player) {
      const key = `${String(player?.externalProvider || '').toUpperCase()}:${String(player?.externalPlayerId || '')}`;
      const fix = PREFERRED_EXTERNAL_NAME_FIXES[key];
      if (!fix) return false;
      const currentName = String(player?.name || '').replace(/\s+/g, '');
      if (!(fix.aliases || []).includes(currentName)) return false;
      player.name = fix.name;
      return true;
    }

    function applyStoredPreferredExternalTeam(player) {
      const key = `${String(player?.externalProvider || '').toUpperCase()}:${String(player?.externalPlayerId || '')}`;
      const preferredTeam = PREFERRED_EXTERNAL_TEAM_FIXES[key];
      if (!preferredTeam || player?.externalTeam === preferredTeam) return false;
      player.externalTeam = preferredTeam;
      return true;
    }
    let renderToken = 0;
    let photoDrag = null;
    let photoZoomSaveTimer = null;
    let preparedOutput = null;
    let preparedOutputs = [];
    let preparedOutputKind = 'daily';
    let batchReportOutputs = [];
    let batchReportPreferences = {};
    let newPlayerSuggestTimer = null;
    let newPlayerSuggestRequestId = 0;
    let newPlayerSuggestionPicked = false;
    let newPlayerSuggestionItems = [];
    let newExternalSelected = null;
    let newPlayerTypeTouched = false;
    const internationalRosterCache = new Map();
    const internationalRosterLoading = new Set();
    const internationalTeamCache = new Map();
    const internationalTeamLoading = new Set();
    const photoImageCache = new Map();
    const TEMPLATES = {
      bg1: {
        label: '預設',
        enabled: true,
        innerBg: '#152238',
        frameSize: 18,
        header: { x: 54, y: 44, w: 972, h: 116, r: 24, bg: '#20324f' },
        metricCards: [
          { x: 54,  y: 184, w: 312, h: 150, r: 22, bg: '#243957', label: '#cbd5e1', value: '#ffffff' },
          { x: 384, y: 184, w: 312, h: 150, r: 22, bg: '#d7ad52', label: '#172033', value: '#172033' },
          { x: 714, y: 184, w: 312, h: 150, r: 22, bg: '#243957', label: '#cbd5e1', value: '#ffffff' }
        ],
        detail: { x: 54, y: 370, w: 454, h: 656, r: 26, bg: '#f4f6f9' },
        photo: { x: 548, y: 370, w: 478, h: 530, r: 26, bg: '#314766' },
        name: {
          textX: 568,
          textY: 995,
          lineX: 568,
          lineY: 1010,
          lineW: 430,
          typeX: 570,
          typeY: 1036
        },
        fonts: {
          headerVs: 46,
          headerDate: 34,
          metricLabel: 30,
          metricValue: 58,
          paNumber: 28,
          paResult: 42,
          paRbi: 24,
          pitcherTitle: 42,
          pitcherLabel: 25,
          pitcherValue: 34,
          playerName: 50,
          playerType: 24,
          tagText: 30
        },
        decorHeads: { enabled: true }
      },

      // 第二個背景接口：之後把 enabled 改成 true，再修改下面座標／顏色即可啟用。
bg2: {
        label: '棒球Q版',
        enabled: true,
        style: 'baseball-q',
        frameSize: 0,
        innerBg: '#f4f1ed',

        // 左上深色三角：VS 對手 + 日期
        header: {
          drawBox: false,
          vsX: 34,
          vsY: 70,
          dateX: 34,
          dateY: 120,
          textColor: '#ffffff',
          dateColor: '#ffffff'
        },

        // Q版棒球用具下方的三圍
        metricCards: [
          { x: 380, y: 292, w: 210, h: 112, r: 0, bg: 'rgba(255,255,255,.82)', label: '#10284a', value: '#10284a' },
          { x: 606, y: 292, w: 210, h: 112, r: 0, bg: 'rgba(255,255,255,.82)', label: '#10284a', value: '#10284a' },
          { x: 832, y: 292, w: 210, h: 112, r: 0, bg: 'rgba(255,255,255,.82)', label: '#10284a', value: '#10284a' }
        ],

        // 左側直接疊在背景上，不畫白框
        detail: {
          drawBox: false,
          x: 62,
          y: 458,
          w: 492,
          h: 500,
          headingX: 160,
          headingY: 421,
          underlineX: 160,
          underlineY: 438,
          underlineW: 410,
          paStartY: 493,
          paStep: 58,
          paNumberX: 92,
          paTextX: 142,
          dividerX1: 70,
          dividerX2: 548,
          pitcherLabelX: 82,
          pitcherValueX: 545,
          pitcherStartY: 500,
          pitcherStep: 52,
          tagsX: 70,
          tagsBottom: 955,
          tagsW: 480
        },

        // 右側照片，上緣與逐打席下方線對齊，左右斜切
        photo: {
          x: 604,
          y: 438,
          w: 438,
          h: 545,
          r: 0,
          bg: 'rgba(255,255,255,.58)',
          border: '#ef4f43',
          borderWidth: 3,
          cutTopLeft: 74,
          cutBottomRight: 150
        },

        // 右下斜角區球員名稱
        name: {
          textX: 715,
          textY: 1034,
          lineX: 715,
          lineY: 1046,
          lineW: 300,
          typeX: 718,
          typeY: 1070,
          maxWidth: 310,
          color: '#10284a',
          typeColor: '#52657d',
          lineColor: '#ef4f43'
        },

        // 第二背景完全獨立的字體大小
        fonts: {
          headerVs: 34,
          headerDate: 24,
          metricLabel: 23,
          metricValue: 43,
          paNumber: 23,
          paResult: 34,
          paRbi: 20,
          pitcherTitle: 34,
          pitcherLabel: 22,
          pitcherValue: 30,
          playerName: 42,
          playerType: 19,
          tagText: 25
        },

        decorHeads: { enabled: false }
      },

      bg3: {
        label: '球場夜戰',
        enabled: true,
        style: 'stadium-night',
        frameSize: 0,
        innerBg: '#081522',
        header: {
          drawBox: false,
          vsX: 62, vsY: 92,
          dateX: 1015, dateY: 91,
          dateAlign: 'right',
          textColor: '#ffffff',
          dateColor: '#e7c66a'
        },
        metricCards: [
          { x: 54,  y: 142, w: 306, h: 116, r: 18, bg: 'rgba(7,25,42,.82)', border: 'rgba(255,255,255,.18)', label: '#a9bdd0', value: '#ffffff', labelOffset: 37, valueOffset: 88 },
          { x: 387, y: 142, w: 306, h: 116, r: 18, bg: 'rgba(190,145,48,.92)', border: 'rgba(255,255,255,.26)', label: '#11263b', value: '#0c2034', labelOffset: 37, valueOffset: 88 },
          { x: 720, y: 142, w: 306, h: 116, r: 18, bg: 'rgba(7,25,42,.82)', border: 'rgba(255,255,255,.18)', label: '#a9bdd0', value: '#ffffff', labelOffset: 37, valueOffset: 88 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 54, y: 292, w: 470, h: 690, r: 24,
          bg: 'rgba(6,20,34,.88)',
          textColor: '#f5f8fb',
          mutedColor: '#9fb1c2',
          accentColor: '#e7c66a',
          dividerColor: 'rgba(255,255,255,.16)',
          paCircle: '#d5a43e',
          paCircleAlt: '#173a5d',
          paCircleText: '#0b1d2e',
          paCircleAltText: '#ffffff',
          rbiColor: '#f1ce70',
          headingX: 82, headingY: 344,
          underlineX: 82, underlineY: 360, underlineW: 410,
          paStartY: 408, paStep: 68,
          paNumberX: 91, paTextX: 140,
          dividerX1: 76, dividerX2: 500,
          pitcherLabelX: 82, pitcherValueX: 492,
          pitcherStartY: 416, pitcherStep: 61,
          tagsX: 72, tagsBottom: 958, tagsW: 430,
          appearanceFontSize: 27
        },
        photo: {
          x: 558, y: 292, w: 468, h: 600, r: 26,
          bg: '#10263a',
          border: 'rgba(255,255,255,.46)',
          borderWidth: 3
        },
        name: {
          textX: 580, textY: 948,
          lineX: 580, lineY: 968, lineW: 420, lineH: 4,
          typeX: 582, typeY: 1002,
          maxWidth: 420, minFont: 28,
          color: '#ffffff',
          typeColor: '#a9bdd0',
          lineColor: '#e7c66a'
        },
        fonts: {
          headerVs: 39, headerDate: 27,
          metricLabel: 24, metricValue: 46,
          paNumber: 23, paResult: 33, paRbi: 20,
          pitcherTitle: 32, pitcherLabel: 23, pitcherValue: 31,
          playerName: 46, playerType: 20, tagText: 25
        },
        decorHeads: { enabled: false }
      },

      bg4: {
        label: '棒球縫線',
        enabled: true,
        style: 'baseball-seam',
        frameSize: 0,
        innerBg: '#f3eee5',
        header: {
          drawBox: false,
          vsX: 60, vsY: 92,
          dateX: 1010, dateY: 90,
          dateAlign: 'right',
          textColor: '#12304b',
          dateColor: '#a42e2e'
        },
        metricCards: [
          { x: 498, y: 154, w: 168, h: 118, r: 18, bg: 'rgba(255,255,255,.88)', border: '#d8cbbb', label: '#6d7884', value: '#15324d', labelOffset: 38, valueOffset: 90 },
          { x: 678, y: 154, w: 168, h: 118, r: 18, bg: '#173a59', border: '#173a59', label: '#d9e4ee', value: '#ffffff', labelOffset: 38, valueOffset: 90 },
          { x: 858, y: 154, w: 168, h: 118, r: 18, bg: 'rgba(255,255,255,.88)', border: '#d8cbbb', label: '#6d7884', value: '#15324d', labelOffset: 38, valueOffset: 90 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 500, y: 304, w: 526, h: 656, r: 24,
          bg: 'rgba(255,255,255,.86)',
          textColor: '#17324b',
          mutedColor: '#6d7884',
          accentColor: '#b83a35',
          dividerColor: 'rgba(23,50,75,.16)',
          paCircle: '#b83a35',
          paCircleAlt: '#173a59',
          paCircleText: '#ffffff',
          paCircleAltText: '#ffffff',
          rbiColor: '#a67826',
          headingX: 532, headingY: 356,
          underlineX: 532, underlineY: 373, underlineW: 455,
          paStartY: 421, paStep: 64,
          paNumberX: 537, paTextX: 584,
          dividerX1: 520, dividerX2: 1000,
          pitcherLabelX: 532, pitcherValueX: 992,
          pitcherStartY: 428, pitcherStep: 58,
          tagsX: 520, tagsBottom: 936, tagsW: 480,
          appearanceFontSize: 27
        },
        photo: {
          x: 54, y: 270, w: 410, h: 600, r: 28,
          bg: '#ded5c7',
          border: '#b83a35',
          borderWidth: 4
        },
        name: {
          textX: 72, textY: 925,
          lineX: 72, lineY: 945, lineW: 365, lineH: 4,
          typeX: 74, typeY: 980,
          maxWidth: 372, minFont: 27,
          color: '#17324b',
          typeColor: '#6f7880',
          lineColor: '#b83a35'
        },
        fonts: {
          headerVs: 38, headerDate: 26,
          metricLabel: 22, metricValue: 42,
          paNumber: 22, paResult: 31, paRbi: 19,
          pitcherTitle: 31, pitcherLabel: 22, pitcherValue: 30,
          playerName: 44, playerType: 19, tagText: 24
        },
        decorHeads: { enabled: false }
      },

      bg5: {
        label: '牛棚練習場',
        enabled: true,
        style: 'bullpen',
        frameSize: 0,
        innerBg: '#1c2824',
        header: {
          drawBox: false,
          vsX: 58, vsY: 90,
          dateX: 1015, dateY: 89,
          dateAlign: 'right',
          textColor: '#f5f1e7',
          dateColor: '#dcc38a'
        },
        metricCards: [
          { x: 54,  y: 152, w: 164, h: 112, r: 14, bg: 'rgba(21,37,32,.90)', border: '#aa9468', label: '#b8c4bc', value: '#ffffff', labelOffset: 36, valueOffset: 86 },
          { x: 232, y: 152, w: 164, h: 112, r: 14, bg: '#c7a866', border: '#e1ca94', label: '#25342e', value: '#17241f', labelOffset: 36, valueOffset: 86 },
          { x: 410, y: 152, w: 164, h: 112, r: 14, bg: 'rgba(21,37,32,.90)', border: '#aa9468', label: '#b8c4bc', value: '#ffffff', labelOffset: 36, valueOffset: 86 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 54, y: 308, w: 520, h: 660, r: 18,
          bg: 'rgba(18,31,27,.82)',
          textColor: '#f6f4ee',
          mutedColor: '#aebbb3',
          accentColor: '#d9bd7a',
          dividerColor: 'rgba(223,210,180,.15)',
          paCircle: '#c7a866',
          paCircleAlt: '#355346',
          paCircleText: '#17241f',
          paCircleAltText: '#ffffff',
          rbiColor: '#e7ca82',
          headingX: 82, headingY: 360,
          underlineX: 82, underlineY: 377, underlineW: 458,
          paStartY: 425, paStep: 65,
          paNumberX: 88, paTextX: 136,
          dividerX1: 74, dividerX2: 550,
          pitcherLabelX: 80, pitcherValueX: 550,
          pitcherStartY: 432, pitcherStep: 58,
          tagsX: 72, tagsBottom: 944, tagsW: 472,
          appearanceFontSize: 27
        },
        photo: {
          x: 610, y: 220, w: 416, h: 650, r: 18,
          bg: '#253a32',
          border: '#c9b27e',
          borderWidth: 4
        },
        name: {
          plateX: 606, plateY: 880, plateW: 424, plateH: 116, plateR: 16,
          plateBg: 'rgba(8,20,16,.92)',
          plateBorder: 'rgba(209,187,135,.72)',
          textX: 626, textY: 925,
          lineX: 626, lineY: 945, lineW: 372, lineH: 4,
          typeX: 628, typeY: 980,
          maxWidth: 380, minFont: 27,
          color: '#f7f3e9',
          typeColor: '#c7d0ca',
          lineColor: '#c7a866'
        },
        fonts: {
          headerVs: 38, headerDate: 26,
          metricLabel: 22, metricValue: 42,
          paNumber: 22, paResult: 31, paRbi: 19,
          pitcherTitle: 31, pitcherLabel: 22, pitcherValue: 30,
          playerName: 44, playerType: 19, tagText: 24
        },
        decorHeads: { enabled: false }
      },

      bg6: {
        label: '記分板科技風',
        enabled: true,
        style: 'scoreboard-tech',
        frameSize: 0,
        innerBg: '#071018',
        header: {
          drawBox: false,
          vsX: 58, vsY: 92,
          dateX: 1018, dateY: 91,
          dateAlign: 'right',
          textColor: '#dcecff',
          dateColor: '#ffcc4d'
        },
        metricCards: [
          { x: 54,  y: 156, w: 196, h: 118, r: 10, bg: 'rgba(8,23,34,.94)', border: '#2b607b', label: '#78a8be', value: '#f6fbff', labelOffset: 38, valueOffset: 91 },
          { x: 266, y: 156, w: 196, h: 118, r: 10, bg: 'rgba(255,193,57,.94)', border: '#ffd36a', label: '#17212a', value: '#111920', labelOffset: 38, valueOffset: 91 },
          { x: 478, y: 156, w: 196, h: 118, r: 10, bg: 'rgba(8,23,34,.94)', border: '#2b607b', label: '#78a8be', value: '#f6fbff', labelOffset: 38, valueOffset: 91 }
        ],
        detail: {
          positioned: true,
          drawBox: true,
          x: 54, y: 316, w: 500, h: 650, r: 16,
          bg: 'rgba(5,16,24,.91)',
          border: 'rgba(49,116,148,.72)',
          borderWidth: 2,
          textColor: '#eaf6ff',
          mutedColor: '#83a4b4',
          accentColor: '#ffca45',
          dividerColor: 'rgba(80,155,188,.22)',
          paCircle: '#ffca45',
          paCircleAlt: '#123b50',
          paCircleText: '#17212a',
          paCircleAltText: '#ffffff',
          rbiColor: '#ffd86b',
          headingX: 82, headingY: 368,
          underlineX: 82, underlineY: 385, underlineW: 438,
          paStartY: 434, paStep: 64,
          paNumberX: 90, paTextX: 138,
          dividerX1: 74, dividerX2: 530,
          pitcherLabelX: 82, pitcherValueX: 530,
          pitcherStartY: 440, pitcherStep: 58,
          tagsX: 72, tagsBottom: 944, tagsW: 452,
          appearanceFontSize: 27
        },
        photo: {
          x: 590, y: 316, w: 436, h: 532, r: 12,
          bg: '#0a1c29',
          border: '#3d83a3',
          borderWidth: 3
        },
        name: {
          plateX: 586, plateY: 870, plateW: 444, plateH: 112, plateR: 12,
          plateBg: 'rgba(4,13,20,.95)',
          plateBorder: 'rgba(255,202,69,.72)',
          textX: 610, textY: 916,
          lineX: 610, lineY: 936, lineW: 394, lineH: 3,
          typeX: 612, typeY: 970,
          maxWidth: 396, minFont: 27,
          color: '#f5fbff',
          typeColor: '#75a2b7',
          lineColor: '#ffca45'
        },
        fonts: {
          headerVs: 38, headerDate: 26,
          metricLabel: 22, metricValue: 42,
          paNumber: 22, paResult: 31, paRbi: 19,
          pitcherTitle: 31, pitcherLabel: 22, pitcherValue: 30,
          playerName: 44, playerType: 19, tagText: 24
        },
        decorHeads: { enabled: false }
      }
    };

    let currentTemplate = localStorage.getItem('baseballCardTemplate') || 'bg1';
    if (!TEMPLATES[currentTemplate]?.enabled) currentTemplate = 'bg1';

