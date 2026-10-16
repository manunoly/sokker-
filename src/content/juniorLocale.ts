export interface JuniorStrings {
    observations: string;
    sokkerTalent: string;
    curveTalent: string;
    capturedWeek: string;
    lastRecorded: string;
    weeksPerLevel: string;
    insufficient: string;
    noProgress: string;
    lessThanThree: string;
    moreThanTwelve: string;
    syncing: string;
    updating: string;
    updateFailed: string;
    loadFailed: string;
    noData: string;
    unavailable: string;
    observed: string;
    trend: string;
    relativeWeek: string;
    remainingWeek: string;
    level: string;
    relativeExplanation: string;
    countdownExplanation: string;
    pointsHeading: string;
    keyboardHint: string;
    downloadPng: string;
    downloadFailed: string;
}

const strings: Record<string, JuniorStrings> = {
    en: {
        observations: 'observations', sokkerTalent: 'Sokker talent', curveTalent: 'Talent estimated from curve',
        capturedWeek: 'Captured in game week', lastRecorded: 'Last recorded value', weeksPerLevel: 'weeks per level',
        insufficient: 'Insufficient data', noProgress: 'No measurable progress', lessThanThree: 'Less than 3',
        moreThanTwelve: 'More than 12', syncing: 'Syncing data…', updating: 'Updating; showing saved data.',
        updateFailed: 'Update failed; showing saved data.', loadFailed: 'Could not load junior data.',
        noData: 'No observed levels yet.', unavailable: 'Unavailable', observed: 'Observed', trend: 'Trend',
        relativeWeek: 'Relative week', level: 'Level',
        relativeExplanation: 'Weeks elapsed since the first observation; gaps have no observed level.',
        remainingWeek: 'Weeks left',
        countdownExplanation: 'Weeks remaining until academy exit (0 is departure); gaps have no observed level.',
        pointsHeading: 'Observed weekly levels', keyboardHint: 'Press Down Arrow to explore this card.',
        downloadPng: 'Download PNG', downloadFailed: 'Could not download PNG.'
    },
    es: {
        observations: 'observaciones', sokkerTalent: 'Talento de Sokker', curveTalent: 'Talento estimado por curva',
        capturedWeek: 'Capturado en la semana del juego', lastRecorded: 'Último valor registrado',
        weeksPerLevel: 'semanas por nivel', insufficient: 'Datos insuficientes',
        noProgress: 'Sin progreso medible', lessThanThree: 'Menos de 3', moreThanTwelve: 'Más de 12',
        syncing: 'Sincronizando datos…', updating: 'Actualizando; se muestran los datos guardados.',
        updateFailed: 'Falló la actualización; se muestran los datos guardados.',
        loadFailed: 'No se pudieron cargar los datos del juvenil.', noData: 'Aún no hay niveles observados.',
        unavailable: 'No disponible', observed: 'Real', trend: 'Tendencia', relativeWeek: 'Semana relativa',
        level: 'Nivel', relativeExplanation: 'Semanas desde la primera observación; los huecos no contienen niveles observados.',
        remainingWeek: 'Semanas restantes',
        countdownExplanation: 'Semanas restantes hasta salir de la cantera (0 es la salida); los huecos no tienen nivel observado.',
        pointsHeading: 'Niveles semanales observados', keyboardHint: 'Pulsa Flecha abajo para explorar este recuadro.',
        downloadPng: 'Descargar PNG', downloadFailed: 'No se pudo descargar el PNG.'
    },
    pl: {
        observations: 'obserwacji', sokkerTalent: 'Talent Sokker', curveTalent: 'Talent oszacowany z wykresu',
        capturedWeek: 'Zapisano w tygodniu gry', lastRecorded: 'Ostatnia zapisana wartość',
        weeksPerLevel: 'tygodni na poziom', insufficient: 'Za mało danych', noProgress: 'Brak mierzalnego postępu',
        lessThanThree: 'Mniej niż 3', moreThanTwelve: 'Więcej niż 12', syncing: 'Synchronizowanie danych…',
        updating: 'Aktualizacja; wyświetlane są zapisane dane.', updateFailed: 'Aktualizacja nie powiodła się; wyświetlane są zapisane dane.',
        loadFailed: 'Nie można wczytać danych juniora.', noData: 'Brak zaobserwowanych poziomów.',
        unavailable: 'Niedostępne', observed: 'Rzeczywiste', trend: 'Trend', relativeWeek: 'Tydzień względny',
        level: 'Poziom', relativeExplanation: 'Tygodnie od pierwszej obserwacji; luki nie zawierają zaobserwowanych poziomów.',
        remainingWeek: 'Pozostałe tygodnie',
        countdownExplanation: 'Tygodnie do opuszczenia szkółki (0 oznacza odejście); luki nie mają zaobserwowanego poziomu.',
        pointsHeading: 'Zaobserwowane poziomy tygodniowe', keyboardHint: 'Naciśnij strzałkę w dół, aby przeglądać tę kartę.',
        downloadPng: 'Pobierz PNG', downloadFailed: 'Nie udało się pobrać PNG.'
    },
    pt: {
        observations: 'observações', sokkerTalent: 'Talento Sokker', curveTalent: 'Talento estimado pela curva',
        capturedWeek: 'Registado na semana de jogo', lastRecorded: 'Último valor registado',
        weeksPerLevel: 'semanas por nível', insufficient: 'Dados insuficientes', noProgress: 'Sem progresso mensurável',
        lessThanThree: 'Menos de 3', moreThanTwelve: 'Mais de 12', syncing: 'A sincronizar dados…',
        updating: 'A atualizar; a mostrar dados guardados.', updateFailed: 'A atualização falhou; a mostrar dados guardados.',
        loadFailed: 'Não foi possível carregar os dados do júnior.', noData: 'Ainda não há níveis observados.',
        unavailable: 'Indisponível', observed: 'Real', trend: 'Tendência', relativeWeek: 'Semana relativa',
        level: 'Nível', relativeExplanation: 'Semanas desde a primeira observação; as lacunas não têm níveis observados.',
        remainingWeek: 'Semanas restantes',
        countdownExplanation: 'Semanas até sair da academia (0 é a saída); as lacunas não têm nível observado.',
        pointsHeading: 'Níveis semanais observados', keyboardHint: 'Prima a seta para baixo para explorar este painel.',
        downloadPng: 'Baixar PNG', downloadFailed: 'Não foi possível baixar o PNG.'
    },
    it: {
        observations: 'osservazioni', sokkerTalent: 'Talento Sokker', curveTalent: 'Talento stimato dalla curva',
        capturedWeek: 'Registrato nella settimana di gioco', lastRecorded: 'Ultimo valore registrato',
        weeksPerLevel: 'settimane per livello', insufficient: 'Dati insufficienti', noProgress: 'Nessun progresso misurabile',
        lessThanThree: 'Meno di 3', moreThanTwelve: 'Più di 12', syncing: 'Sincronizzazione dati…',
        updating: 'Aggiornamento; sono mostrati i dati salvati.', updateFailed: 'Aggiornamento non riuscito; sono mostrati i dati salvati.',
        loadFailed: 'Impossibile caricare i dati del giovane.', noData: 'Nessun livello osservato.',
        unavailable: 'Non disponibile', observed: 'Reale', trend: 'Tendenza', relativeWeek: 'Settimana relativa',
        level: 'Livello', relativeExplanation: 'Settimane dalla prima osservazione; le lacune non hanno livelli osservati.',
        remainingWeek: 'Settimane rimanenti',
        countdownExplanation: 'Settimane prima dell’uscita dal vivaio (0 è l’uscita); le lacune non hanno un livello osservato.',
        pointsHeading: 'Livelli settimanali osservati', keyboardHint: 'Premi Freccia giù per esplorare questo riquadro.',
        downloadPng: 'Scarica PNG', downloadFailed: 'Impossibile scaricare il PNG.'
    },
    de: {
        observations: 'Beobachtungen', sokkerTalent: 'Sokker-Talent', curveTalent: 'Aus Kurve geschätztes Talent',
        capturedWeek: 'Erfasst in Spielwoche', lastRecorded: 'Zuletzt erfasster Wert',
        weeksPerLevel: 'Wochen pro Stufe', insufficient: 'Nicht genügend Daten', noProgress: 'Kein messbarer Fortschritt',
        lessThanThree: 'Weniger als 3', moreThanTwelve: 'Mehr als 12', syncing: 'Daten werden synchronisiert…',
        updating: 'Aktualisierung; gespeicherte Daten werden angezeigt.', updateFailed: 'Aktualisierung fehlgeschlagen; gespeicherte Daten werden angezeigt.',
        loadFailed: 'Juniorendaten konnten nicht geladen werden.', noData: 'Noch keine beobachteten Stufen.',
        unavailable: 'Nicht verfügbar', observed: 'Beobachtet', trend: 'Trend', relativeWeek: 'Relative Woche',
        level: 'Stufe', relativeExplanation: 'Wochen seit der ersten Beobachtung; Lücken enthalten keine beobachtete Stufe.',
        remainingWeek: 'Verbleibende Wochen',
        countdownExplanation: 'Wochen bis zum Austritt aus der Jugend (0 ist der Austritt); Lücken haben keine beobachtete Stufe.',
        pointsHeading: 'Beobachtete Wochenstufen', keyboardHint: 'Drücke Pfeil nach unten, um dieses Feld zu erkunden.',
        downloadPng: 'PNG herunterladen', downloadFailed: 'PNG konnte nicht heruntergeladen werden.'
    },
    ro: {
        observations: 'observații', sokkerTalent: 'Talent Sokker', curveTalent: 'Talent estimat din curbă',
        capturedWeek: 'Înregistrat în săptămâna de joc', lastRecorded: 'Ultima valoare înregistrată',
        weeksPerLevel: 'săptămâni pe nivel', insufficient: 'Date insuficiente', noProgress: 'Fără progres măsurabil',
        lessThanThree: 'Mai puțin de 3', moreThanTwelve: 'Mai mult de 12', syncing: 'Se sincronizează datele…',
        updating: 'Se actualizează; sunt afișate datele salvate.', updateFailed: 'Actualizarea a eșuat; sunt afișate datele salvate.',
        loadFailed: 'Nu s-au putut încărca datele juniorului.', noData: 'Nu există încă niveluri observate.',
        unavailable: 'Indisponibil', observed: 'Observat', trend: 'Tendință', relativeWeek: 'Săptămână relativă',
        level: 'Nivel', relativeExplanation: 'Săptămâni de la prima observație; lipsurile nu conțin niveluri observate.',
        remainingWeek: 'Săptămâni rămase',
        countdownExplanation: 'Săptămâni până la ieșirea din academie (0 este ieșirea); lipsurile nu au nivel observat.',
        pointsHeading: 'Niveluri săptămânale observate', keyboardHint: 'Apasă săgeata în jos pentru a explora acest panou.',
        downloadPng: 'Descarcă PNG', downloadFailed: 'Nu s-a putut descărca PNG-ul.'
    },
    tr: {
        observations: 'gözlem', sokkerTalent: 'Sokker yeteneği', curveTalent: 'Eğriden tahmini yetenek',
        capturedWeek: 'Oyun haftasında kaydedildi', lastRecorded: 'Son kaydedilen değer',
        weeksPerLevel: 'seviye başına hafta', insufficient: 'Yetersiz veri', noProgress: 'Ölçülebilir ilerleme yok',
        lessThanThree: '3’ten az', moreThanTwelve: '12’den fazla', syncing: 'Veriler eşitleniyor…',
        updating: 'Güncelleniyor; kayıtlı veriler gösteriliyor.', updateFailed: 'Güncelleme başarısız; kayıtlı veriler gösteriliyor.',
        loadFailed: 'Genç oyuncu verileri yüklenemedi.', noData: 'Henüz gözlemlenen seviye yok.',
        unavailable: 'Kullanılamıyor', observed: 'Gerçek', trend: 'Eğilim', relativeWeek: 'Göreli hafta',
        level: 'Seviye', relativeExplanation: 'İlk gözlemden bu yana geçen haftalar; boşluklarda gözlemlenen seviye yoktur.',
        remainingWeek: 'Kalan hafta',
        countdownExplanation: 'Altyapıdan ayrılmaya kalan haftalar (0 ayrılış); boşluklarda gözlenen seviye yoktur.',
        pointsHeading: 'Gözlemlenen haftalık seviyeler', keyboardHint: 'Bu kartı incelemek için Aşağı Ok tuşuna basın.',
        downloadPng: 'PNG indir', downloadFailed: 'PNG indirilemedi.'
    }
};

function supportedLanguage(value: string): string | null {
    const code = value.trim().toLowerCase().split(/[-_]/)[0];
    return Object.prototype.hasOwnProperty.call(strings, code) ? code : null;
}

export function getJuniorLanguage(pathname: string, documentLang: string, browserLang: string): string {
    const pathLanguage = pathname.match(/^\/([a-z]{2})(?:-[a-z]{2})?\/app(?:\/|$)/i)?.[1];
    if (pathLanguage) return supportedLanguage(pathLanguage) || 'en';
    return supportedLanguage(documentLang) || supportedLanguage(browserLang) || 'en';
}

export function getJuniorStrings(pathname: string, documentLang: string, browserLang: string): JuniorStrings {
    return strings[getJuniorLanguage(pathname, documentLang, browserLang)];
}

export function formatJuniorNumber(value: number, language: string, maximumFractionDigits = 2): string {
    return new Intl.NumberFormat(language, { maximumFractionDigits }).format(value);
}
