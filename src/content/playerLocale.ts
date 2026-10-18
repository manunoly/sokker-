import type { PlayerSkill } from '../core/playerTimeline';
import { getJuniorLanguage } from './juniorLocale';

export interface PlayerStrings {
    language: string;
    title: string;
    history: string;
    week: string;
    observedWeek: string;
    weeks: string;
    record: string;
    posSkill: string;
    effectiveness: string;
    exportCsv: string;
    downloadPng: string;
    downloadFailed: string;
    close: string;
    noData: string;
    advanced: string;
    formation: string;
    countMeaning: { advanced: string; formation: string };
    sinceRise: string;
    noRise: string;
    minimum: string;
    observedPace: string;
    weeksPerLevel: string;
    insufficient: string;
    noProgress: string;
    staminaInfo: string;
    observed: string;
    trend: string;
    observations: string;
    observedLevels: string;
    injured: string;
    realReport: string;
    reference: string;
    uncertainWeek: string;
    sources: { individual: string; formation: string; carriedOver: string; rosterFallback: string; reportNoDetail: string };
    skills: Record<PlayerSkill, string>;
}

type Text = Omit<PlayerStrings, 'language'>;

const translations: Record<string, Text> = {
    en: {
        title: 'General Skills ++', history: 'History', week: 'Week', observedWeek: 'Observed week', weeks: 'weeks',
        record: 'Record', posSkill: 'Pos / Skill', effectiveness: 'Eff', exportCsv: 'Export CSV',
        downloadPng: 'Download PNG', downloadFailed: 'Could not download PNG.', close: 'Close', noData: 'No saved history.',
        advanced: 'Advanced', formation: 'Formation', sinceRise: 'since the last observed rise in week',
        countMeaning: { advanced: 'weeks directly training this skill', formation: 'effective training weeks without direct focus on this skill' },
        noRise: 'no rise observed; the start of this interval is unknown', minimum: 'minimum known; reports or weeks are missing',
        observedPace: 'Observed pace', weeksPerLevel: 'weeks per level', insufficient: 'Insufficient data',
        noProgress: 'No measurable progress', staminaInfo: 'Stamina varies; no pace is estimated.',
        observed: 'Observed', trend: 'Trend', observations: 'observations', observedLevels: 'Saved weekly levels',
        injured: 'Injured in this record', realReport: 'Real report', reference: 'reference',
        uncertainWeek: 'Invalid capture date; stored report week used for the curve.',
        sources: { individual: 'Advanced', formation: 'Formation', carriedOver: 'No report', rosterFallback: 'Roster only', reportNoDetail: 'Report without detail' },
        skills: { stamina: 'Stamina', pace: 'Pace', technique: 'Technique', passing: 'Passing', keeper: 'Keeper', defending: 'Defending', playmaking: 'Playmaking', striker: 'Striker' }
    },
    es: {
        title: 'Habilidades generales ++', history: 'Historial', week: 'Semana', observedWeek: 'Semana observada', weeks: 'semanas',
        record: 'Registro', posSkill: 'Pos / Skill', effectiveness: 'Efect.', exportCsv: 'Exportar CSV',
        downloadPng: 'Descargar PNG', downloadFailed: 'No se pudo descargar el PNG.', close: 'Cerrar', noData: 'No hay historial guardado.',
        advanced: 'Avanzados', formation: 'Formación', sinceRise: 'desde la última subida observada en la semana',
        countMeaning: { advanced: 'semanas de entrenamiento directo de esta habilidad', formation: 'semanas con entrenamiento efectivo sin foco directo en esta habilidad' },
        noRise: 'sin subida observada; se desconoce el inicio del tramo', minimum: 'mínimo conocido; faltan semanas o informes',
        observedPace: 'Ritmo observado', weeksPerLevel: 'semanas por nivel', insufficient: 'Datos insuficientes',
        noProgress: 'Sin progreso medible', staminaInfo: 'La resistencia fluctúa; no se estima un ritmo.',
        observed: 'Real', trend: 'Tendencia', observations: 'observaciones', observedLevels: 'Niveles semanales guardados',
        injured: 'Lesionado en este registro', realReport: 'Informe real', reference: 'referencia',
        uncertainWeek: 'Fecha de captura inválida; se usa la semana del informe en la curva.',
        sources: { individual: 'Avanzado', formation: 'Formación', carriedOver: 'Sin informe', rosterFallback: 'Solo plantilla', reportNoDetail: 'Informe sin detalle' },
        skills: { stamina: 'Resistencia', pace: 'Ritmo', technique: 'Técnica', passing: 'Pases', keeper: 'Portería', defending: 'Defensa', playmaking: 'Creación', striker: 'Anotación' }
    },
    pl: {
        title: 'Umiejętności ogólne ++', history: 'Historia', week: 'Tydzień', observedWeek: 'Tydzień obserwacji', weeks: 'tygodni',
        record: 'Zapis', posSkill: 'Poz. / Umiejętność', effectiveness: 'Skut.', exportCsv: 'Eksportuj CSV',
        downloadPng: 'Pobierz PNG', downloadFailed: 'Nie udało się pobrać PNG.', close: 'Zamknij', noData: 'Brak zapisanej historii.',
        advanced: 'Zaawansowane', formation: 'Formacja', sinceRise: 'od ostatniego zaobserwowanego wzrostu w tygodniu',
        countMeaning: { advanced: 'tygodnie bezpośredniego treningu tej umiejętności', formation: 'tygodnie efektywnego treningu bez bezpośredniego skupienia na tej umiejętności' },
        noRise: 'brak wzrostu w historii; początek okresu jest nieznany', minimum: 'znane minimum; brakuje tygodni lub raportów',
        observedPace: 'Zaobserwowane tempo', weeksPerLevel: 'tygodni na poziom', insufficient: 'Za mało danych',
        noProgress: 'Brak mierzalnego postępu', staminaInfo: 'Kondycja się waha; tempo nie jest szacowane.',
        observed: 'Rzeczywiste', trend: 'Trend', observations: 'obserwacji', observedLevels: 'Zapisane poziomy tygodniowe',
        injured: 'Kontuzja w tym zapisie', realReport: 'Rzeczywisty raport', reference: 'odniesienie',
        uncertainWeek: 'Nieprawidłowa data; na wykresie użyto tygodnia raportu.',
        sources: { individual: 'Zaawansowany', formation: 'Formacja', carriedOver: 'Bez raportu', rosterFallback: 'Tylko skład', reportNoDetail: 'Raport bez szczegółów' },
        skills: { stamina: 'Kondycja', pace: 'Szybkość', technique: 'Technika', passing: 'Podania', keeper: 'Bramkarz', defending: 'Obrona', playmaking: 'Rozgrywanie', striker: 'Strzelanie' }
    },
    pt: {
        title: 'Habilidades gerais ++', history: 'Histórico', week: 'Semana', observedWeek: 'Semana observada', weeks: 'semanas',
        record: 'Registo', posSkill: 'Pos. / Habilidade', effectiveness: 'Efet.', exportCsv: 'Exportar CSV',
        downloadPng: 'Baixar PNG', downloadFailed: 'Não foi possível baixar o PNG.', close: 'Fechar', noData: 'Sem histórico guardado.',
        advanced: 'Avançados', formation: 'Formação', sinceRise: 'desde a última subida observada na semana',
        countMeaning: { advanced: 'semanas de treino direto desta habilidade', formation: 'semanas de treino eficaz sem foco direto nesta habilidade' },
        noRise: 'nenhuma subida observada; início do período desconhecido', minimum: 'mínimo conhecido; faltam semanas ou relatórios',
        observedPace: 'Ritmo observado', weeksPerLevel: 'semanas por nível', insufficient: 'Dados insuficientes',
        noProgress: 'Sem progresso mensurável', staminaInfo: 'A resistência varia; não se estima um ritmo.',
        observed: 'Real', trend: 'Tendência', observations: 'observações', observedLevels: 'Níveis semanais guardados',
        injured: 'Lesionado neste registo', realReport: 'Relatório real', reference: 'referência',
        uncertainWeek: 'Data inválida; usa-se a semana do relatório no gráfico.',
        sources: { individual: 'Avançado', formation: 'Formação', carriedOver: 'Sem relatório', rosterFallback: 'Só plantel', reportNoDetail: 'Relatório sem detalhe' },
        skills: { stamina: 'Resistência', pace: 'Velocidade', technique: 'Técnica', passing: 'Passe', keeper: 'Guarda-redes', defending: 'Defesa', playmaking: 'Criatividade', striker: 'Finalização' }
    },
    it: {
        title: 'Abilità generali ++', history: 'Storico', week: 'Settimana', observedWeek: 'Settimana osservata', weeks: 'settimane',
        record: 'Registro', posSkill: 'Pos. / Abilità', effectiveness: 'Effic.', exportCsv: 'Esporta CSV',
        downloadPng: 'Scarica PNG', downloadFailed: 'Impossibile scaricare il PNG.', close: 'Chiudi', noData: 'Nessuno storico salvato.',
        advanced: 'Avanzati', formation: 'Formazione', sinceRise: "dall'ultimo aumento osservato nella settimana",
        countMeaning: { advanced: 'settimane di allenamento diretto di questa abilità', formation: 'settimane di allenamento efficace senza focus diretto su questa abilità' },
        noRise: 'nessun aumento osservato; inizio del periodo sconosciuto', minimum: 'minimo noto; mancano settimane o rapporti',
        observedPace: 'Ritmo osservato', weeksPerLevel: 'settimane per livello', insufficient: 'Dati insufficienti',
        noProgress: 'Nessun progresso misurabile', staminaInfo: 'La resistenza varia; nessun ritmo stimato.',
        observed: 'Reale', trend: 'Tendenza', observations: 'osservazioni', observedLevels: 'Livelli settimanali salvati',
        injured: 'Infortunato in questo registro', realReport: 'Rapporto reale', reference: 'riferimento',
        uncertainWeek: 'Data non valida; nel grafico viene usata la settimana del rapporto.',
        sources: { individual: 'Avanzato', formation: 'Formazione', carriedOver: 'Senza rapporto', rosterFallback: 'Solo rosa', reportNoDetail: 'Rapporto senza dettagli' },
        skills: { stamina: 'Resistenza', pace: 'Velocità', technique: 'Tecnica', passing: 'Passaggi', keeper: 'Parate', defending: 'Difesa', playmaking: 'Regia', striker: 'Attacco' }
    },
    de: {
        title: 'Allgemeine Fähigkeiten ++', history: 'Verlauf', week: 'Woche', observedWeek: 'Beobachtete Woche', weeks: 'Wochen',
        record: 'Eintrag', posSkill: 'Pos. / Fähigkeit', effectiveness: 'Eff.', exportCsv: 'CSV exportieren',
        downloadPng: 'PNG herunterladen', downloadFailed: 'PNG konnte nicht heruntergeladen werden.', close: 'Schließen', noData: 'Kein gespeicherter Verlauf.',
        advanced: 'Intensiv', formation: 'Formation', sinceRise: 'seit dem letzten beobachteten Anstieg in Woche',
        countMeaning: { advanced: 'Wochen mit direktem Training dieser Fähigkeit', formation: 'Wochen mit wirksamem Training ohne direkten Fokus auf diese Fähigkeit' },
        noRise: 'kein Anstieg beobachtet; Beginn des Abschnitts unbekannt', minimum: 'bekanntes Minimum; Wochen oder Berichte fehlen',
        observedPace: 'Beobachtetes Tempo', weeksPerLevel: 'Wochen pro Stufe', insufficient: 'Nicht genügend Daten',
        noProgress: 'Kein messbarer Fortschritt', staminaInfo: 'Kondition schwankt; kein Tempo geschätzt.',
        observed: 'Beobachtet', trend: 'Trend', observations: 'Beobachtungen', observedLevels: 'Gespeicherte Wochenwerte',
        injured: 'In diesem Eintrag verletzt', realReport: 'Echter Bericht', reference: 'Referenz',
        uncertainWeek: 'Ungültiges Datum; Berichtswoche für die Kurve verwendet.',
        sources: { individual: 'Intensiv', formation: 'Formation', carriedOver: 'Kein Bericht', rosterFallback: 'Nur Kader', reportNoDetail: 'Bericht ohne Details' },
        skills: { stamina: 'Kondition', pace: 'Schnelligkeit', technique: 'Technik', passing: 'Passspiel', keeper: 'Torwart', defending: 'Verteidigung', playmaking: 'Spielaufbau', striker: 'Sturm' }
    },
    ro: {
        title: 'Abilități generale ++', history: 'Istoric', week: 'Săptămână', observedWeek: 'Săptămână observată', weeks: 'săptămâni',
        record: 'Înregistrare', posSkill: 'Poz. / Abilitate', effectiveness: 'Efic.', exportCsv: 'Exportă CSV',
        downloadPng: 'Descarcă PNG', downloadFailed: 'Nu s-a putut descărca PNG-ul.', close: 'Închide', noData: 'Nu există istoric salvat.',
        advanced: 'Avansate', formation: 'Formare', sinceRise: 'de la ultima creștere observată în săptămâna',
        countMeaning: { advanced: 'săptămâni cu antrenament direct al acestei abilități', formation: 'săptămâni cu antrenament eficient fără accent direct pe această abilitate' },
        noRise: 'nicio creștere observată; începutul intervalului necunoscut', minimum: 'minim cunoscut; lipsesc săptămâni sau rapoarte',
        observedPace: 'Ritm observat', weeksPerLevel: 'săptămâni pe nivel', insufficient: 'Date insuficiente',
        noProgress: 'Fără progres măsurabil', staminaInfo: 'Rezistența variază; ritmul nu este estimat.',
        observed: 'Observat', trend: 'Tendință', observations: 'observații', observedLevels: 'Niveluri săptămânale salvate',
        injured: 'Accidentat în această înregistrare', realReport: 'Raport real', reference: 'referință',
        uncertainWeek: 'Dată invalidă; săptămâna raportului este folosită în grafic.',
        sources: { individual: 'Avansat', formation: 'Formare', carriedOver: 'Fără raport', rosterFallback: 'Doar lot', reportNoDetail: 'Raport fără detalii' },
        skills: { stamina: 'Rezistență', pace: 'Viteză', technique: 'Tehnică', passing: 'Pase', keeper: 'Portar', defending: 'Apărare', playmaking: 'Construcție', striker: 'Atac' }
    },
    tr: {
        title: 'Genel beceriler ++', history: 'Geçmiş', week: 'Hafta', observedWeek: 'Gözlenen hafta', weeks: 'hafta',
        record: 'Kayıt', posSkill: 'Poz. / Beceri', effectiveness: 'Etki', exportCsv: 'CSV dışa aktar',
        downloadPng: 'PNG indir', downloadFailed: 'PNG indirilemedi.', close: 'Kapat', noData: 'Kayıtlı geçmiş yok.',
        advanced: 'İleri', formation: 'Formasyon', sinceRise: 'son gözlenen artıştan beri, hafta',
        countMeaning: { advanced: 'bu becerinin doğrudan çalışıldığı haftalar', formation: 'bu beceriye doğrudan odaklanılmadan etkili antrenman yapılan haftalar' },
        noRise: 'artış gözlenmedi; aralığın başlangıcı bilinmiyor', minimum: 'bilinen alt sınır; hafta veya raporlar eksik',
        observedPace: 'Gözlenen hız', weeksPerLevel: 'seviye başına hafta', insufficient: 'Yetersiz veri',
        noProgress: 'Ölçülebilir ilerleme yok', staminaInfo: 'Kondisyon değişkendir; hız tahmin edilmez.',
        observed: 'Gerçek', trend: 'Eğilim', observations: 'gözlem', observedLevels: 'Kaydedilmiş haftalık seviyeler',
        injured: 'Bu kayıtta sakat', realReport: 'Gerçek rapor', reference: 'referans',
        uncertainWeek: 'Geçersiz tarih; grafikte kayıtlı rapor haftası kullanıldı.',
        sources: { individual: 'İleri', formation: 'Formasyon', carriedOver: 'Rapor yok', rosterFallback: 'Yalnız kadro', reportNoDetail: 'Ayrıntısız rapor' },
        skills: { stamina: 'Kondisyon', pace: 'Hız', technique: 'Teknik', passing: 'Pas', keeper: 'Kalecilik', defending: 'Defans', playmaking: 'Oyunkuruculuk', striker: 'Golcülük' }
    }
};

export function getPlayerStrings(pathname: string, documentLang: string, browserLang: string): PlayerStrings {
    const language = getJuniorLanguage(pathname, documentLang, browserLang);
    return { language, ...translations[language] };
}

export function formatPlayerNumber(value: number, language: string, maximumFractionDigits = 1): string {
    return new Intl.NumberFormat(language, { maximumFractionDigits }).format(value);
}
