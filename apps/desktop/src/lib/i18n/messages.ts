import type {
  LensStatus,
  ThemePreference,
  VisualPreset,
  WindowAttachmentState,
} from "../contracts";
import { LOCALE_TAG } from "./locale";
import { type Messages, PRODUCT_NAME, type ResolvedLanguage } from "./types";

export function getMessages(language: ResolvedLanguage): Messages {
  const number = new Intl.NumberFormat(LOCALE_TAG[language]);
  const formatCount = (count: number) => number.format(count);

  const base = {
    effectSummary: ({
      coveredCount,
      presetLabel,
      status,
      targetTitle,
      visibleCount,
    }: {
      coveredCount: number;
      presetLabel: string;
      status: LensStatus;
      targetTitle: string | null;
      visibleCount: number;
    }) => {
      switch (status) {
        case "pending":
          return coveredCount > 1
            ? pendingMany(language, presetLabel)
            : pendingOne(language, presetLabel, targetTitle);
        case "attached":
          return coveredCount > 1
            ? appliedMany(language, presetLabel, Math.max(visibleCount, 1), formatCount)
            : appliedOne(language, presetLabel, targetTitle);
        case "suspended":
        case "detached":
          return detachedEffectMessage(language);
      }
    },
    applyButton: ({
      busy,
      hasPreset,
      hasSelectedWindow,
      presetLabel,
    }: {
      busy: boolean;
      hasPreset: boolean;
      hasSelectedWindow: boolean;
      presetLabel: string | null;
    }) => {
      if (busy) {
        return getApplying(language);
      }

      if (!hasSelectedWindow) {
        return getChooseWindow(language);
      }

      if (!hasPreset || !presetLabel) {
        return getChooseEffect(language);
      }

      return getApplyPreset(language, presetLabel);
    },
    applyHint: (attachmentState: WindowAttachmentState | null) => {
      if (!attachmentState) {
        return getSelectWindowToContinue(language);
      }

      if (attachmentState === "minimized") {
        return getApplyHintMinimized(language);
      }

      return getApplyHintReady(language);
    },
    presetLabel: (preset: VisualPreset) => getPresetLabel(language, preset),
    presetSummary: (preset: VisualPreset) => getPresetSummary(language, preset),
    themeLabel: (theme: ThemePreference) => getThemeLabel(language, theme),
    windowEffectLabel: (status: LensStatus) => getWindowEffectLabel(language, status),
    windowState: (state: WindowAttachmentState) => getWindowState(language, state),
  } satisfies Pick<
    Messages,
    | "effectSummary"
    | "applyButton"
    | "applyHint"
    | "presetLabel"
    | "presetSummary"
    | "themeLabel"
    | "windowEffectLabel"
    | "windowState"
  >;

  switch (language) {
    case "fr":
      return {
        ...base,
        advancedDetails: "Détails avancés",
        appSubtitle:
          "Choisissez une fenêtre et appliquez un effet sans changer le reste du bureau.",
        application: "Application",
        applied: "Appliqué",
        applying: "Application…",
        availableWindows: "Fenêtres disponibles",
        backend: "Backend",
        bounds: "Limites",
        chooseEffect: "Choisissez un effet",
        chooseWindow: "Choisissez une fenêtre",
        copyDebugReport: "Copier le rapport de débogage",
        copyDebugReportFailure: "Impossible de copier le rapport de débogage.",
        copied: "Copié",
        copying: "Copie…",
        effect: "Effet",
        effectHintDetached: "Choisissez l'apparence de la fenêtre sélectionnée.",
        executablePath: "Chemin de l'exécutable",
        executableUnavailable: "Exécutable indisponible",
        filterWindows: "Filtrer les fenêtres",
        filterWindowsPlaceholder: "Filtrer par titre de fenêtre",
        language: "Langue",
        loadingMessage:
          "Ouverture de l'espace de travail et chargement de la liste actuelle des fenêtres.",
        logFile: "Fichier journal",
        logs: "Journaux",
        minimized: "Réduite",
        noWindowsAvailable:
          "Aucune fenêtre n'est disponible pour l'instant. Affichez l'application cible puis attendez un instant.",
        noWindowsMatch: "Aucune fenêtre ne correspond au filtre actuel.",
        off: "Désactivé",
        openLogs: "Ouvrir les journaux",
        openLogsFailure: "Impossible d'ouvrir le dossier des journaux.",
        openProductFailure: `Impossible d'ouvrir ${PRODUCT_NAME}.`,
        opening: "Ouverture…",
        pending: "En attente",
        process: "Processus",
        refreshWindowListFailure: "Impossible d'actualiser la liste des fenêtres.",
        recentEvents: (count) => `Événements récents (${formatCount(count)})`,
        recentEventsSubtitle: "Les plus récents d'abord.",
        relatedWindows: "Appliquer aux fenêtres liées",
        relatedWindowsDescription:
          "Conserver automatiquement l'effet sur les nouvelles fenêtres de la même application lorsque c'est possible.",
        runtime: "Exécution",
        runtimeSubtitle: "Détails d'exécution locaux uniquement.",
        selectWindowToContinue: "Sélectionnez une fenêtre pour continuer.",
        selectedWindow: "Fenêtre sélectionnée",
        selectedWindowEmpty:
          "Sélectionnez une fenêtre dans la liste pour choisir où appliquer l'effet.",
        settings: "Paramètres",
        settingsFile: "Fichier des paramètres",
        state: "État",
        supportDiagnostics: "Support et diagnostics",
        system: "Système",
        theme: "Thème",
        title: "Titre",
        turningOff: "Désactivation…",
        turnOff: "Désactiver",
        unexpectedBridgeError: "Erreur inattendue du pont desktop.",
        unavailable: "Indisponible",
        windowCount: "Nombre de fenêtres",
        windowId: "ID de fenêtre",
        windowClass: "Classe de fenêtre",
        windowsMatch: (count) => `${formatCount(count)} fenêtres correspondent.`,
        windowsShown: (count) =>
          `${formatCount(count)} fenêtres affichées. Mise à jour automatique.`,
      };
    case "zh-Hans":
      return {
        ...base,
        advancedDetails: "高级详情",
        appSubtitle: "选择一个窗口并应用效果，而不影响桌面的其他部分。",
        application: "应用程序",
        applied: "已应用",
        applying: "正在应用…",
        availableWindows: "可用窗口",
        backend: "后端",
        bounds: "边界",
        chooseEffect: "选择效果",
        chooseWindow: "选择窗口",
        copyDebugReport: "复制调试报告",
        copyDebugReportFailure: "无法复制调试报告。",
        copied: "已复制",
        copying: "正在复制…",
        effect: "效果",
        effectHintDetached: "选择所选窗口的显示方式。",
        executablePath: "可执行文件路径",
        executableUnavailable: "可执行文件不可用",
        filterWindows: "筛选窗口",
        filterWindowsPlaceholder: "按窗口标题筛选",
        language: "语言",
        loadingMessage: "正在打开工作区并加载当前窗口列表。",
        logFile: "日志文件",
        logs: "日志",
        minimized: "已最小化",
        noWindowsAvailable: "暂时没有可用窗口。请先将目标应用显示到桌面上，然后稍等片刻。",
        noWindowsMatch: "没有窗口与当前筛选条件匹配。",
        off: "已关闭",
        openLogs: "打开日志",
        openLogsFailure: "无法打开日志目录。",
        openProductFailure: `无法打开 ${PRODUCT_NAME}。`,
        opening: "正在打开…",
        pending: "等待中",
        process: "进程",
        refreshWindowListFailure: "无法刷新窗口列表。",
        recentEvents: (count) => `最近事件（${formatCount(count)}）`,
        recentEventsSubtitle: "最新事件在前。",
        relatedWindows: "应用到相关窗口",
        relatedWindowsDescription: "在可能的情况下，自动将效果保留在同一应用的新窗口上。",
        runtime: "运行时",
        runtimeSubtitle: "仅限本地的运行时详情。",
        selectWindowToContinue: "选择一个窗口以继续。",
        selectedWindow: "已选窗口",
        selectedWindowEmpty: "从列表中选择一个窗口，以决定将效果应用到哪里。",
        settings: "设置",
        settingsFile: "设置文件",
        state: "状态",
        supportDiagnostics: "支持与诊断",
        system: "系统",
        theme: "主题",
        title: "标题",
        turningOff: "正在关闭…",
        turnOff: "关闭",
        unexpectedBridgeError: "桌面桥接发生意外错误。",
        unavailable: "不可用",
        windowCount: "窗口数量",
        windowId: "窗口 ID",
        windowClass: "窗口类",
        windowsMatch: (count) => `${formatCount(count)} 个窗口匹配。`,
        windowsShown: (count) => `显示 ${formatCount(count)} 个窗口。自动更新。`,
      };
    case "hi":
      return {
        ...base,
        advancedDetails: "विस्तृत विवरण",
        appSubtitle: "एक विंडो चुनें और बाकी डेस्कटॉप बदले बिना उस पर प्रभाव लागू करें।",
        application: "ऐप",
        applied: "लागू",
        applying: "लागू किया जा रहा है…",
        availableWindows: "उपलब्ध विंडो",
        backend: "बैकएंड",
        bounds: "सीमाएं",
        chooseEffect: "प्रभाव चुनें",
        chooseWindow: "विंडो चुनें",
        copyDebugReport: "डिबग रिपोर्ट कॉपी करें",
        copyDebugReportFailure: "डिबग रिपोर्ट कॉपी नहीं हो सकी।",
        copied: "कॉपी हो गया",
        copying: "कॉपी किया जा रहा है…",
        effect: "प्रभाव",
        effectHintDetached: "चुनें कि चुनी गई विंडो कैसी दिखे।",
        executablePath: "एक्ज़ीक्यूटेबल पथ",
        executableUnavailable: "एक्ज़ीक्यूटेबल उपलब्ध नहीं है",
        filterWindows: "विंडो फ़िल्टर करें",
        filterWindowsPlaceholder: "विंडो शीर्षक से फ़िल्टर करें",
        language: "भाषा",
        loadingMessage: "वर्कस्पेस खोला जा रहा है और मौजूदा विंडो सूची लोड की जा रही है।",
        logFile: "लॉग फ़ाइल",
        logs: "लॉग",
        minimized: "मिनिमाइज़्ड",
        noWindowsAvailable: "अभी कोई विंडो उपलब्ध नहीं है। लक्ष्य ऐप को डेस्कटॉप पर लाएं और थोड़ा इंतज़ार करें।",
        noWindowsMatch: "कोई विंडो वर्तमान फ़िल्टर से मेल नहीं खाती।",
        off: "बंद",
        openLogs: "लॉग खोलें",
        openLogsFailure: "लॉग फ़ोल्डर नहीं खोला जा सका।",
        openProductFailure: `${PRODUCT_NAME} नहीं खोला जा सका।`,
        opening: "खोला जा रहा है…",
        pending: "प्रतीक्षारत",
        process: "प्रोसेस",
        refreshWindowListFailure: "विंडो सूची रीफ़्रेश नहीं की जा सकी।",
        recentEvents: (count) => `हाल की घटनाएँ (${formatCount(count)})`,
        recentEventsSubtitle: "सबसे नई पहले।",
        relatedWindows: "संबंधित विंडो पर लागू करें",
        relatedWindowsDescription: "जहाँ संभव हो, उसी ऐप की नई विंडो पर प्रभाव अपने आप बनाए रखें।",
        runtime: "रनटाइम",
        runtimeSubtitle: "सिर्फ़ लोकल रनटाइम विवरण।",
        selectWindowToContinue: "आगे बढ़ने के लिए एक विंडो चुनें।",
        selectedWindow: "चुनी गई विंडो",
        selectedWindowEmpty: "प्रभाव कहाँ लागू करना है, यह चुनने के लिए सूची से एक विंडो चुनें।",
        settings: "सेटिंग्स",
        settingsFile: "सेटिंग्स फ़ाइल",
        state: "स्थिति",
        supportDiagnostics: "सहायता और निदान",
        system: "सिस्टम",
        theme: "थीम",
        title: "शीर्षक",
        turningOff: "बंद किया जा रहा है…",
        turnOff: "बंद करें",
        unexpectedBridgeError: "डेस्कटॉप ब्रिज में अप्रत्याशित त्रुटि।",
        unavailable: "उपलब्ध नहीं",
        windowCount: "विंडो संख्या",
        windowId: "विंडो आईडी",
        windowClass: "विंडो क्लास",
        windowsMatch: (count) => `${formatCount(count)} विंडो मेल खाती हैं।`,
        windowsShown: (count) => `${formatCount(count)} विंडो दिखाई गईं। सूची अपने आप अपडेट होती है।`,
      };
    case "ar":
      return {
        ...base,
        advancedDetails: "تفاصيل متقدمة",
        appSubtitle: "اختر نافذة وطبّق تأثيرًا عليها من دون تغيير بقية سطح المكتب.",
        application: "التطبيق",
        applied: "مطبّق",
        applying: "جارٍ التطبيق…",
        availableWindows: "النوافذ المتاحة",
        backend: "الواجهة الخلفية",
        bounds: "الحدود",
        chooseEffect: "اختر تأثيرًا",
        chooseWindow: "اختر نافذة",
        copyDebugReport: "انسخ تقرير التصحيح",
        copyDebugReportFailure: "تعذّر نسخ تقرير التصحيح.",
        copied: "تم النسخ",
        copying: "جارٍ النسخ…",
        effect: "التأثير",
        effectHintDetached: "اختر كيف يجب أن تبدو النافذة المحددة.",
        executablePath: "مسار الملف التنفيذي",
        executableUnavailable: "الملف التنفيذي غير متاح",
        filterWindows: "تصفية النوافذ",
        filterWindowsPlaceholder: "صفِّ حسب عنوان النافذة",
        language: "اللغة",
        loadingMessage: "جارٍ فتح مساحة العمل وتحميل قائمة النوافذ الحالية.",
        logFile: "ملف السجل",
        logs: "السجلات",
        minimized: "مصغّرة",
        noWindowsAvailable:
          "لا توجد نوافذ متاحة بعد. أظهر التطبيق الهدف على سطح المكتب وانتظر قليلًا.",
        noWindowsMatch: "لا توجد نوافذ تطابق عامل التصفية الحالي.",
        off: "متوقف",
        openLogs: "افتح السجلات",
        openLogsFailure: "تعذّر فتح مجلد السجلات.",
        openProductFailure: `تعذّر فتح ${PRODUCT_NAME}.`,
        opening: "جارٍ الفتح…",
        pending: "قيد الانتظار",
        process: "العملية",
        refreshWindowListFailure: "تعذّر تحديث قائمة النوافذ.",
        recentEvents: (count) => `الأحداث الأخيرة (${formatCount(count)})`,
        recentEventsSubtitle: "الأحدث أولًا.",
        relatedWindows: "طبّق على النوافذ المرتبطة",
        relatedWindowsDescription:
          "أبقِ التأثير تلقائيًا على النوافذ الجديدة من التطبيق نفسه عندما يكون ذلك ممكنًا.",
        runtime: "بيئة التشغيل",
        runtimeSubtitle: "تفاصيل تشغيل محلية فقط.",
        selectWindowToContinue: "اختر نافذة للمتابعة.",
        selectedWindow: "النافذة المحددة",
        selectedWindowEmpty: "اختر نافذة من القائمة لتحديد مكان تطبيق التأثير.",
        settings: "الإعدادات",
        settingsFile: "ملف الإعدادات",
        state: "الحالة",
        supportDiagnostics: "الدعم والتشخيص",
        system: "النظام",
        theme: "السمة",
        title: "العنوان",
        turningOff: "جارٍ الإيقاف…",
        turnOff: "أوقف",
        unexpectedBridgeError: "خطأ غير متوقع في جسر سطح المكتب.",
        unavailable: "غير متاح",
        windowCount: "عدد النوافذ",
        windowId: "معرّف النافذة",
        windowClass: "فئة النافذة",
        windowsMatch: (count) => `${formatCount(count)} نافذة مطابقة.`,
        windowsShown: (count) => `يتم عرض ${formatCount(count)} نافذة. يتم التحديث تلقائيًا.`,
      };
    case "bn":
      return {
        ...base,
        advancedDetails: "উন্নত বিবরণ",
        appSubtitle: "একটি উইন্ডো বেছে নিন এবং ডেস্কটপের বাকি অংশ না বদলে তাতে একটি ইফেক্ট প্রয়োগ করুন।",
        application: "অ্যাপ",
        applied: "প্রয়োগ করা হয়েছে",
        applying: "প্রয়োগ করা হচ্ছে…",
        availableWindows: "উপলব্ধ উইন্ডো",
        backend: "ব্যাকএন্ড",
        bounds: "সীমানা",
        chooseEffect: "ইফেক্ট বেছে নিন",
        chooseWindow: "উইন্ডো বেছে নিন",
        copyDebugReport: "ডিবাগ রিপোর্ট কপি করুন",
        copyDebugReportFailure: "ডিবাগ রিপোর্ট কপি করা যায়নি।",
        copied: "কপি হয়েছে",
        copying: "কপি করা হচ্ছে…",
        effect: "ইফেক্ট",
        effectHintDetached: "নির্বাচিত উইন্ডোটি কেমন দেখাবে তা বেছে নিন।",
        executablePath: "এক্সিকিউটেবল পথ",
        executableUnavailable: "এক্সিকিউটেবল উপলব্ধ নয়",
        filterWindows: "উইন্ডো ফিল্টার করুন",
        filterWindowsPlaceholder: "উইন্ডোর শিরোনাম দিয়ে ফিল্টার করুন",
        language: "ভাষা",
        loadingMessage: "ওয়ার্কস্পেস খোলা হচ্ছে এবং বর্তমান উইন্ডো তালিকা লোড করা হচ্ছে।",
        logFile: "লগ ফাইল",
        logs: "লগ",
        minimized: "মিনিমাইজ করা",
        noWindowsAvailable: "এখনও কোনো উইন্ডো উপলব্ধ নয়। লক্ষ্য অ্যাপটি ডেস্কটপে আনুন এবং একটু অপেক্ষা করুন।",
        noWindowsMatch: "বর্তমান ফিল্টারের সাথে কোনো উইন্ডো মেলেনি।",
        off: "বন্ধ",
        openLogs: "লগ খুলুন",
        openLogsFailure: "লগ ডিরেক্টরি খোলা যায়নি।",
        openProductFailure: `${PRODUCT_NAME} খোলা যায়নি।`,
        opening: "খোলা হচ্ছে…",
        pending: "অপেক্ষমাণ",
        process: "প্রসেস",
        refreshWindowListFailure: "উইন্ডো তালিকা রিফ্রেশ করা যায়নি।",
        recentEvents: (count) => `সাম্প্রতিক ঘটনা (${formatCount(count)})`,
        recentEventsSubtitle: "সর্বশেষটি আগে।",
        relatedWindows: "সম্পর্কিত উইন্ডোতে প্রয়োগ করুন",
        relatedWindowsDescription: "যখন সম্ভব, একই অ্যাপের নতুন উইন্ডোগুলোতে ইফেক্টটি স্বয়ংক্রিয়ভাবে চালু রাখুন।",
        runtime: "রানটাইম",
        runtimeSubtitle: "শুধু স্থানীয় রানটাইম বিবরণ।",
        selectWindowToContinue: "চালিয়ে যেতে একটি উইন্ডো বেছে নিন।",
        selectedWindow: "নির্বাচিত উইন্ডো",
        selectedWindowEmpty: "ইফেক্ট কোথায় যাবে তা বেছে নিতে তালিকা থেকে একটি উইন্ডো নির্বাচন করুন।",
        settings: "সেটিংস",
        settingsFile: "সেটিংস ফাইল",
        state: "অবস্থা",
        supportDiagnostics: "সহায়তা ও ডায়াগনস্টিক্স",
        system: "সিস্টেম",
        theme: "থিম",
        title: "শিরোনাম",
        turningOff: "বন্ধ করা হচ্ছে…",
        turnOff: "বন্ধ করুন",
        unexpectedBridgeError: "ডেস্কটপ ব্রিজে অপ্রত্যাশিত ত্রুটি।",
        unavailable: "উপলব্ধ নয়",
        windowCount: "উইন্ডোর সংখ্যা",
        windowId: "উইন্ডো আইডি",
        windowClass: "উইন্ডো ক্লাস",
        windowsMatch: (count) => `${formatCount(count)}টি উইন্ডো মেলে।`,
        windowsShown: (count) =>
          `${formatCount(count)}টি উইন্ডো দেখানো হয়েছে। তালিকা স্বয়ংক্রিয়ভাবে আপডেট হয়।`,
      };
    case "pt-BR":
      return {
        ...base,
        advancedDetails: "Detalhes avançados",
        appSubtitle:
          "Escolha uma janela e aplique um efeito sem mudar o resto da área de trabalho.",
        application: "Aplicativo",
        applied: "Aplicado",
        applying: "Aplicando…",
        availableWindows: "Janelas disponíveis",
        backend: "Backend",
        bounds: "Limites",
        chooseEffect: "Escolha um efeito",
        chooseWindow: "Escolha uma janela",
        copyDebugReport: "Copiar relatório de depuração",
        copyDebugReportFailure: "Falha ao copiar o relatório de depuração.",
        copied: "Copiado",
        copying: "Copiando…",
        effect: "Efeito",
        effectHintDetached: "Escolha como a janela selecionada deve ficar.",
        executablePath: "Caminho do executável",
        executableUnavailable: "Executável indisponível",
        filterWindows: "Filtrar janelas",
        filterWindowsPlaceholder: "Filtrar pelo título da janela",
        language: "Idioma",
        loadingMessage: "Abrindo o espaço de trabalho e carregando a lista atual de janelas.",
        logFile: "Arquivo de log",
        logs: "Logs",
        minimized: "Minimizada",
        noWindowsAvailable:
          "Nenhuma janela está disponível ainda. Traga o aplicativo alvo para a área de trabalho e aguarde um instante.",
        noWindowsMatch: "Nenhuma janela corresponde ao filtro atual.",
        off: "Desligado",
        openLogs: "Abrir logs",
        openLogsFailure: "Falha ao abrir o diretório de logs.",
        openProductFailure: `Falha ao abrir ${PRODUCT_NAME}.`,
        opening: "Abrindo…",
        pending: "Pendente",
        process: "Processo",
        refreshWindowListFailure: "Falha ao atualizar a lista de janelas.",
        recentEvents: (count) => `Eventos recentes (${formatCount(count)})`,
        recentEventsSubtitle: "Mais novos primeiro.",
        relatedWindows: "Aplicar às janelas relacionadas",
        relatedWindowsDescription:
          "Mantenha automaticamente o efeito em novas janelas do mesmo aplicativo quando possível.",
        runtime: "Tempo de execução",
        runtimeSubtitle: "Detalhes locais do tempo de execução.",
        selectWindowToContinue: "Selecione uma janela para continuar.",
        selectedWindow: "Janela selecionada",
        selectedWindowEmpty: "Selecione uma janela na lista para escolher onde o efeito deve ir.",
        settings: "Configurações",
        settingsFile: "Arquivo de configurações",
        state: "Estado",
        supportDiagnostics: "Suporte e diagnósticos",
        system: "Sistema",
        theme: "Tema",
        title: "Título",
        turningOff: "Desligando…",
        turnOff: "Desligar",
        unexpectedBridgeError: "Erro inesperado da ponte do desktop.",
        unavailable: "Indisponível",
        windowCount: "Quantidade de janelas",
        windowId: "ID da janela",
        windowClass: "Classe da janela",
        windowsMatch: (count) => `${formatCount(count)} janelas correspondem.`,
        windowsShown: (count) =>
          `${formatCount(count)} janelas exibidas. Atualiza automaticamente.`,
      };
    case "es":
      return {
        ...base,
        advancedDetails: "Detalles avanzados",
        appSubtitle: "Elige una ventana y aplica un efecto sin cambiar el resto del escritorio.",
        application: "Aplicación",
        applied: "Aplicado",
        applying: "Aplicando…",
        availableWindows: "Ventanas disponibles",
        backend: "Backend",
        bounds: "Límites",
        chooseEffect: "Elige un efecto",
        chooseWindow: "Elige una ventana",
        copyDebugReport: "Copiar informe de depuración",
        copyDebugReportFailure: "No se pudo copiar el informe de depuración.",
        copied: "Copiado",
        copying: "Copiando…",
        effect: "Efecto",
        effectHintDetached: "Elige cómo debe verse la ventana seleccionada.",
        executablePath: "Ruta del ejecutable",
        executableUnavailable: "Ejecutable no disponible",
        filterWindows: "Filtrar ventanas",
        filterWindowsPlaceholder: "Filtrar por título de la ventana",
        language: "Idioma",
        loadingMessage: "Abriendo el espacio de trabajo y cargando la lista actual de ventanas.",
        logFile: "Archivo de registro",
        logs: "Registros",
        minimized: "Minimizada",
        noWindowsAvailable:
          "Todavía no hay ventanas disponibles. Lleva la aplicación objetivo al escritorio y espera un momento.",
        noWindowsMatch: "Ninguna ventana coincide con el filtro actual.",
        off: "Apagado",
        openLogs: "Abrir registros",
        openLogsFailure: "No se pudo abrir el directorio de registros.",
        openProductFailure: `No se pudo abrir ${PRODUCT_NAME}.`,
        opening: "Abriendo…",
        pending: "Pendiente",
        process: "Proceso",
        refreshWindowListFailure: "No se pudo actualizar la lista de ventanas.",
        recentEvents: (count) => `Eventos recientes (${formatCount(count)})`,
        recentEventsSubtitle: "Los más nuevos primero.",
        relatedWindows: "Aplicar a ventanas relacionadas",
        relatedWindowsDescription:
          "Mantén automáticamente el efecto en nuevas ventanas de la misma aplicación cuando sea posible.",
        runtime: "Tiempo de ejecución",
        runtimeSubtitle: "Detalles locales del tiempo de ejecución.",
        selectWindowToContinue: "Selecciona una ventana para continuar.",
        selectedWindow: "Ventana seleccionada",
        selectedWindowEmpty:
          "Selecciona una ventana de la lista para elegir dónde debe ir el efecto.",
        settings: "Configuración",
        settingsFile: "Archivo de configuración",
        state: "Estado",
        supportDiagnostics: "Soporte y diagnósticos",
        system: "Sistema",
        theme: "Tema",
        title: "Título",
        turningOff: "Apagando…",
        turnOff: "Apagar",
        unexpectedBridgeError: "Error inesperado del puente del escritorio.",
        unavailable: "No disponible",
        windowCount: "Cantidad de ventanas",
        windowId: "ID de la ventana",
        windowClass: "Clase de ventana",
        windowsMatch: (count) => `${formatCount(count)} ventanas coinciden.`,
        windowsShown: (count) =>
          `${formatCount(count)} ventanas mostradas. Se actualiza automáticamente.`,
      };
    case "en":
      return {
        ...base,
        advancedDetails: "Advanced details",
        appSubtitle:
          "Choose a window and apply an effect without changing the rest of the desktop.",
        application: "Application",
        applied: "Applied",
        applying: "Applying…",
        availableWindows: "Available windows",
        backend: "Backend",
        bounds: "Bounds",
        chooseEffect: "Choose an effect",
        chooseWindow: "Choose a window",
        copyDebugReport: "Copy debug report",
        copyDebugReportFailure: "Failed to copy the debug report.",
        copied: "Copied",
        copying: "Copying…",
        effect: "Effect",
        effectHintDetached: "Choose how the selected window should look.",
        executablePath: "Executable path",
        executableUnavailable: "Executable unavailable",
        filterWindows: "Filter windows",
        filterWindowsPlaceholder: "Filter by window title",
        language: "Language",
        loadingMessage: "Opening workspace and loading the current window list.",
        logFile: "Log file",
        logs: "Logs",
        minimized: "Minimized",
        noWindowsAvailable:
          "No windows are available yet. Bring the target app to the desktop and wait a moment.",
        noWindowsMatch: "No windows match the current filter.",
        off: "Off",
        openLogs: "Open logs",
        openLogsFailure: "Failed to open the logs directory.",
        openProductFailure: `Failed to open ${PRODUCT_NAME}.`,
        opening: "Opening…",
        pending: "Pending",
        process: "Process",
        refreshWindowListFailure: "Failed to refresh the window list.",
        recentEvents: (count) => `Recent events (${formatCount(count)})`,
        recentEventsSubtitle: "Newest events first.",
        relatedWindows: "Apply to related windows",
        relatedWindowsDescription:
          "Automatically keep the effect on new windows from the same app when possible.",
        runtime: "Runtime",
        runtimeSubtitle: "Local-only runtime details.",
        selectWindowToContinue: "Select a window to continue.",
        selectedWindow: "Selected window",
        selectedWindowEmpty: "Select a window from the list to choose where the effect should go.",
        settings: "Settings",
        settingsFile: "Settings file",
        state: "State",
        supportDiagnostics: "Support & diagnostics",
        system: "System",
        theme: "Theme",
        title: "Title",
        turningOff: "Turning off…",
        turnOff: "Turn off",
        unexpectedBridgeError: "Unexpected desktop bridge error.",
        unavailable: "Unavailable",
        windowCount: "Window count",
        windowId: "Window ID",
        windowClass: "Window class",
        windowsMatch: (count) => `${formatCount(count)} windows match.`,
        windowsShown: (count) => `${formatCount(count)} windows shown. Updates automatically.`,
      };
  }
}

function getPresetLabel(language: ResolvedLanguage, preset: VisualPreset) {
  switch (preset) {
    case "invert":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Inverter";
          case "es":
            return "Invertir";
          case "fr":
            return "Inverser";
          case "zh-Hans":
            return "反相";
          case "hi":
            return "इनवर्ट";
          case "ar":
            return "عكس";
          case "bn":
            return "ইনভার্ট";
          case "en":
            return "Invert";
        }
      })();
    case "warmDim":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Suavizar quente";
          case "es":
            return "Atenuar cálido";
          case "fr":
            return "Atténuation chaude";
          case "zh-Hans":
            return "暖色柔化";
          case "hi":
            return "वॉर्म डिम";
          case "ar":
            return "تعتيم دافئ";
          case "bn":
            return "উষ্ণ ডিম";
          case "en":
            return "Warm Dim";
        }
      })();
    case "greyscaleInvert":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Inverter em tons de cinza";
          case "es":
            return "Invertir en escala de grises";
          case "fr":
            return "Inverser en niveaux de gris";
          case "zh-Hans":
            return "灰度反相";
          case "hi":
            return "ग्रेस्केल इनवर्ट";
          case "ar":
            return "عكس بتدرج رمادي";
          case "bn":
            return "গ্রেস্কেল ইনভার্ট";
          case "en":
            return "Greyscale Invert";
        }
      })();
  }
}

function getPresetSummary(language: ResolvedLanguage, preset: VisualPreset) {
  switch (preset) {
    case "invert":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Uma inversão colorida completa que preserva sinais de cor.";
          case "es":
            return "Una inversión a color completa que conserva las señales de color.";
          case "fr":
            return "Une inversion en couleur complète qui préserve les repères de couleur.";
          case "zh-Hans":
            return "完整的彩色反相，同时保留颜色线索。";
          case "hi":
            return "पूरा रंगीन इनवर्ट, जो रंग संकेतों को बनाए रखता है।";
          case "ar":
            return "عكس كامل بالألوان مع الحفاظ على إشارات الألوان.";
          case "bn":
            return "পূর্ণ রঙিন ইনভার্ট, যা রঙের সংকেতগুলো বজায় রাখে।";
          case "en":
            return "A full-color invert that preserves color cues.";
        }
      })();
    case "warmDim":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Um tom âmbar mais quente para interfaces claras.";
          case "es":
            return "Un matiz ámbar más cálido para interfaces claras.";
          case "fr":
            return "Une teinte ambrée plus chaude pour les interfaces claires.";
          case "zh-Hans":
            return "适合浅色界面的更温暖的琥珀色调。";
          case "hi":
            return "उजले इंटरफ़ेस के लिए एक गर्म एम्बर टिंट।";
          case "ar":
            return "صبغة كهرمانية أكثر دفئًا للواجهات الفاتحة.";
          case "bn":
            return "উজ্জ্বল ইন্টারফেসের জন্য আরও উষ্ণ অ্যাম্বার আভা।";
          case "en":
            return "A warmer amber tint for bright interfaces.";
        }
      })();
    case "greyscaleInvert":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Uma inversão em tons de cinza para interfaces claras que ignoram o modo escuro.";
          case "es":
            return "Una inversión en escala de grises para interfaces claras que ignoran el modo oscuro.";
          case "fr":
            return "Une inversion en niveaux de gris pour les interfaces claires qui ignorent le mode sombre.";
          case "zh-Hans":
            return "适合忽略深色模式的浅色界面的灰度反相。";
          case "hi":
            return "उन हल्के इंटरफ़ेस के लिए ग्रेस्केल इनवर्ट जो डार्क मोड को नज़रअंदाज़ करते हैं।";
          case "ar":
            return "عكس بتدرج رمادي للواجهات الفاتحة التي تتجاهل الوضع الداكن.";
          case "bn":
            return "ডার্ক মোড উপেক্ষা করা হালকা ইন্টারফেসের জন্য গ্রেস্কেল ইনভার্ট।";
          case "en":
            return "A greyscale invert for light interfaces that ignore dark mode.";
        }
      })();
  }
}

function getThemeLabel(language: ResolvedLanguage, theme: ThemePreference) {
  switch (theme) {
    case "system":
      return (() => {
        switch (language) {
          case "pt-BR":
          case "es":
            return "Sistema";
          case "fr":
            return "Système";
          case "zh-Hans":
            return "系统";
          case "hi":
            return "सिस्टम";
          case "ar":
            return "النظام";
          case "bn":
            return "সিস্টেম";
          case "en":
            return "System";
        }
      })();
    case "light":
      return (() => {
        switch (language) {
          case "pt-BR":
          case "es":
            return "Claro";
          case "fr":
            return "Clair";
          case "zh-Hans":
            return "浅色";
          case "hi":
            return "हल्का";
          case "ar":
            return "فاتح";
          case "bn":
            return "হালকা";
          case "en":
            return "Light";
        }
      })();
    case "dark":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Escuro";
          case "es":
            return "Oscuro";
          case "fr":
            return "Sombre";
          case "zh-Hans":
            return "深色";
          case "hi":
            return "गहरा";
          case "ar":
            return "داكن";
          case "bn":
            return "গাঢ়";
          case "en":
            return "Dark";
        }
      })();
    case "invert":
      return getPresetLabel(language, "invert");
    case "greyscaleInvert":
      return getPresetLabel(language, "greyscaleInvert");
  }
}

function getWindowEffectLabel(language: ResolvedLanguage, status: LensStatus) {
  switch (status) {
    case "pending":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Pendente";
          case "es":
            return "Pendiente";
          case "fr":
            return "En attente";
          case "zh-Hans":
            return "等待中";
          case "hi":
            return "प्रतीक्षारत";
          case "ar":
            return "قيد الانتظار";
          case "bn":
            return "অপেক্ষমাণ";
          case "en":
            return "Pending";
        }
      })();
    case "attached":
    case "suspended":
      return (() => {
        switch (language) {
          case "pt-BR":
          case "es":
            return "Aplicado";
          case "fr":
            return "Appliqué";
          case "zh-Hans":
            return "已应用";
          case "hi":
            return "लागू";
          case "ar":
            return "مطبّق";
          case "bn":
            return "প্রয়োগ করা হয়েছে";
          case "en":
            return "Applied";
        }
      })();
    case "detached":
      switch (language) {
        case "pt-BR":
          return "Desligado";
        case "es":
          return "Apagado";
        case "fr":
          return "Désactivé";
        case "zh-Hans":
          return "已关闭";
        case "hi":
          return "बंद";
        case "ar":
          return "متوقف";
        case "bn":
          return "বন্ধ";
        case "en":
          return "Off";
      }
  }
}

function getWindowState(language: ResolvedLanguage, state: WindowAttachmentState) {
  switch (state) {
    case "available":
      return (() => {
        switch (language) {
          case "pt-BR":
            return "Pronta";
          case "es":
            return "Lista";
          case "fr":
            return "Prête";
          case "zh-Hans":
            return "就绪";
          case "hi":
            return "तैयार";
          case "ar":
            return "جاهزة";
          case "bn":
            return "প্রস্তুত";
          case "en":
            return "Ready";
        }
      })();
    case "minimized":
      switch (language) {
        case "pt-BR":
          return "Minimizada; o efeito aparece quando ela voltar à tela";
        case "es":
          return "Minimizada; el efecto aparece cuando vuelva a la pantalla";
        case "fr":
          return "Réduite; l'effet apparaît lorsqu'elle revient à l'écran";
        case "zh-Hans":
          return "已最小化；窗口回到屏幕上时会显示效果";
        case "hi":
          return "मिनिमाइज़्ड; स्क्रीन पर लौटने पर प्रभाव दिखाई देगा";
        case "ar":
          return "مصغّرة؛ سيظهر التأثير عندما تعود إلى الشاشة";
        case "bn":
          return "মিনিমাইজ করা; স্ক্রিনে ফিরলে ইফেক্ট দেখা যাবে";
        case "en":
          return "Minimized; the effect appears once it is back on screen";
      }
  }
}

function detachedEffectMessage(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
      return "Escolha como a janela selecionada deve ficar.";
    case "es":
      return "Elige cómo debe verse la ventana seleccionada.";
    case "fr":
      return "Choisissez l'apparence de la fenêtre sélectionnée.";
    case "zh-Hans":
      return "选择所选窗口的显示方式。";
    case "hi":
      return "चुनें कि चुनी गई विंडो कैसी दिखे।";
    case "ar":
      return "اختر كيف يجب أن تبدو النافذة المحددة.";
    case "bn":
      return "নির্বাচিত উইন্ডোটি কেমন দেখাবে তা বেছে নিন।";
    case "en":
      return "Choose how the selected window should look.";
  }
}

function appliedOne(language: ResolvedLanguage, presetLabel: string, targetTitle: string | null) {
  const title = targetTitle ?? fallbackTarget(language);
  switch (language) {
    case "pt-BR":
      return `${presetLabel} está ativo em ${title}.`;
    case "es":
      return `${presetLabel} está activo en ${title}.`;
    case "fr":
      return `${presetLabel} est actif sur ${title}.`;
    case "zh-Hans":
      return `${presetLabel} 已在 ${title} 上启用。`;
    case "hi":
      return `${presetLabel} ${title} पर सक्रिय है।`;
    case "ar":
      return `${presetLabel} مفعّل على ${title}.`;
    case "bn":
      return `${presetLabel} ${title}-এ সক্রিয় আছে।`;
    case "en":
      return `${presetLabel} is active on ${title}.`;
  }
}

function appliedMany(
  language: ResolvedLanguage,
  presetLabel: string,
  visibleCount: number,
  formatCount: (count: number) => string
) {
  switch (language) {
    case "pt-BR":
      return `${presetLabel} está ativo em ${formatCount(visibleCount)} janelas do mesmo aplicativo.`;
    case "es":
      return `${presetLabel} está activo en ${formatCount(visibleCount)} ventanas de la misma aplicación.`;
    case "fr":
      return `${presetLabel} est actif sur ${formatCount(visibleCount)} fenêtres de la même application.`;
    case "zh-Hans":
      return `${presetLabel} 已在同一应用的 ${formatCount(visibleCount)} 个窗口上启用。`;
    case "hi":
      return `${presetLabel} उसी ऐप की ${formatCount(visibleCount)} विंडो पर सक्रिय है।`;
    case "ar":
      return `${presetLabel} مفعّل على ${formatCount(visibleCount)} نوافذ من التطبيق نفسه.`;
    case "bn":
      return `${presetLabel} একই অ্যাপের ${formatCount(visibleCount)}টি উইন্ডোতে সক্রিয় আছে।`;
    case "en":
      return `${presetLabel} is active on ${formatCount(visibleCount)} windows from the same app.`;
  }
}

function pendingOne(language: ResolvedLanguage, presetLabel: string, targetTitle: string | null) {
  const title = targetTitle ?? fallbackTarget(language);
  switch (language) {
    case "pt-BR":
      return `${presetLabel} aparecerá quando ${title} voltar à tela.`;
    case "es":
      return `${presetLabel} aparecerá cuando ${title} vuelva a la pantalla.`;
    case "fr":
      return `${presetLabel} apparaîtra lorsque ${title} reviendra à l'écran.`;
    case "zh-Hans":
      return `${presetLabel} 会在 ${title} 回到屏幕上时出现。`;
    case "hi":
      return `${title} के स्क्रीन पर लौटने पर ${presetLabel} दिखाई देगा।`;
    case "ar":
      return `سيظهر ${presetLabel} عندما تعود ${title} إلى الشاشة.`;
    case "bn":
      return `${title} স্ক্রিনে ফিরলে ${presetLabel} দেখা যাবে।`;
    case "en":
      return `${presetLabel} will appear when ${title} is back on screen.`;
  }
}

function pendingMany(language: ResolvedLanguage, presetLabel: string) {
  switch (language) {
    case "pt-BR":
      return `${presetLabel} aparecerá quando o aplicativo selecionado voltar à tela.`;
    case "es":
      return `${presetLabel} aparecerá cuando la aplicación seleccionada vuelva a la pantalla.`;
    case "fr":
      return `${presetLabel} apparaîtra lorsque l'application sélectionnée reviendra à l'écran.`;
    case "zh-Hans":
      return `${presetLabel} 会在所选应用回到屏幕上时出现。`;
    case "hi":
      return `चुना गया ऐप स्क्रीन पर लौटने पर ${presetLabel} दिखाई देगा।`;
    case "ar":
      return `سيظهر ${presetLabel} عندما يعود التطبيق المحدد إلى الشاشة.`;
    case "bn":
      return `নির্বাচিত অ্যাপটি স্ক্রিনে ফিরলে ${presetLabel} দেখা যাবে।`;
    case "en":
      return `${presetLabel} will appear when the selected app is back on screen.`;
  }
}

function fallbackTarget(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
      return "a janela selecionada";
    case "es":
      return "la ventana seleccionada";
    case "fr":
      return "la fenêtre sélectionnée";
    case "zh-Hans":
      return "所选窗口";
    case "hi":
      return "चुनी गई विंडो";
    case "ar":
      return "النافذة المحددة";
    case "bn":
      return "নির্বাচিত উইন্ডো";
    case "en":
      return "the selected window";
  }
}

function getApplying(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
    case "es":
      return "Aplicando…";
    case "fr":
      return "Application…";
    case "zh-Hans":
      return "正在应用…";
    case "hi":
      return "लागू किया जा रहा है…";
    case "ar":
      return "جارٍ التطبيق…";
    case "bn":
      return "প্রয়োগ করা হচ্ছে…";
    case "en":
      return "Applying…";
  }
}

function getChooseWindow(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
      return "Escolha uma janela";
    case "es":
      return "Elige una ventana";
    case "fr":
      return "Choisissez une fenêtre";
    case "zh-Hans":
      return "选择窗口";
    case "hi":
      return "विंडो चुनें";
    case "ar":
      return "اختر نافذة";
    case "bn":
      return "উইন্ডো বেছে নিন";
    case "en":
      return "Choose a window";
  }
}

function getChooseEffect(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
      return "Escolha um efeito";
    case "es":
      return "Elige un efecto";
    case "fr":
      return "Choisissez un effet";
    case "zh-Hans":
      return "选择效果";
    case "hi":
      return "प्रभाव चुनें";
    case "ar":
      return "اختر تأثيرًا";
    case "bn":
      return "ইফেক্ট বেছে নিন";
    case "en":
      return "Choose an effect";
  }
}

function getApplyPreset(language: ResolvedLanguage, presetLabel: string) {
  switch (language) {
    case "pt-BR":
    case "es":
      return `Aplicar ${presetLabel}`;
    case "fr":
      return `Appliquer ${presetLabel}`;
    case "zh-Hans":
      return `应用 ${presetLabel}`;
    case "hi":
      return `${presetLabel} लागू करें`;
    case "ar":
      return `طبّق ${presetLabel}`;
    case "bn":
      return `${presetLabel} প্রয়োগ করুন`;
    case "en":
      return `Apply ${presetLabel}`;
  }
}

function getSelectWindowToContinue(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
      return "Selecione uma janela para continuar.";
    case "es":
      return "Selecciona una ventana para continuar.";
    case "fr":
      return "Sélectionnez une fenêtre pour continuer.";
    case "zh-Hans":
      return "选择一个窗口以继续。";
    case "hi":
      return "आगे बढ़ने के लिए एक विंडो चुनें।";
    case "ar":
      return "اختر نافذة للمتابعة.";
    case "bn":
      return "চালিয়ে যেতে একটি উইন্ডো বেছে নিন।";
    case "en":
      return "Select a window to continue.";
  }
}

function getApplyHintMinimized(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
      return "Esta janela está minimizada. O efeito aparecerá quando ela voltar à tela.";
    case "es":
      return "Esta ventana está minimizada. El efecto aparecerá cuando vuelva a la pantalla.";
    case "fr":
      return "Cette fenêtre est réduite. L'effet apparaîtra lorsqu'elle reviendra à l'écran.";
    case "zh-Hans":
      return "此窗口已最小化。回到屏幕上时会显示效果。";
    case "hi":
      return "यह विंडो मिनिमाइज़्ड है। स्क्रीन पर लौटने पर प्रभाव दिखाई देगा।";
    case "ar":
      return "هذه النافذة مصغّرة. سيظهر التأثير عندما تعود إلى الشاشة.";
    case "bn":
      return "এই উইন্ডোটি মিনিমাইজ করা আছে। স্ক্রিনে ফিরলে ইফেক্ট দেখা যাবে।";
    case "en":
      return "This window is minimized. The effect will appear when it is back on screen.";
  }
}

function getApplyHintReady(language: ResolvedLanguage) {
  switch (language) {
    case "pt-BR":
      return "Pronto para aplicar o efeito selecionado a esta janela.";
    case "es":
      return "Listo para aplicar el efecto seleccionado a esta ventana.";
    case "fr":
      return "Prêt à appliquer l'effet sélectionné à cette fenêtre.";
    case "zh-Hans":
      return "已准备好将所选效果应用到此窗口。";
    case "hi":
      return "इस विंडो पर चुना गया प्रभाव लागू करने के लिए तैयार।";
    case "ar":
      return "جاهز لتطبيق التأثير المحدد على هذه النافذة.";
    case "bn":
      return "এই উইন্ডোতে নির্বাচিত ইফেক্ট প্রয়োগ করার জন্য প্রস্তুত।";
    case "en":
      return "Ready to apply the selected effect to this window.";
  }
}
