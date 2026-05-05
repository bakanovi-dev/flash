const fs = require('fs');

// Helper
function tsToSeconds(time) {
  const [mm, ss] = time.split(':').map(Number);
  return mm * 60 + ss;
}
function tsToSegment(time) {
  return Math.min(Math.floor(tsToSeconds(time) / 600) + 1, 6);
}

// ============= PHRASAL VERBS =============
const phrasalVerbs = [
  { phrase: "wake up", time: "01:45", translation: "проснуться", context: "I wasn't the kind of guy who woke up on the floor of someone else's house.", contextTranslation: "Я был не из тех парней, кто просыпается на полу в чужом доме.", literalTranslation: "«будить вверх» — глагол wake (будить) + up подчёркивает выход из состояния сна.", history: "Up в английском давно используется для обозначения активации, перехода в состояние бодрствования (light up, fire up, wake up). Возникло в среднеанглийском." },
  { phrase: "fall into", time: "01:49", translation: "упасть в", context: "...before falling into the pool.", contextTranslation: "...перед тем как упасть в бассейн.", literalTranslation: "«падать внутрь».", history: "Прямое сочетание fall + into. Используется как буквально (in water), так и метафорически: fall into a trap, fall into despair." },
  { phrase: "go wrong", time: "02:00", translation: "пойти не так", context: "How the hell everything could go so wrong so fast.", contextTranslation: "Как, чёрт возьми, всё могло пойти настолько не так и так быстро.", literalTranslation: "«идти неправильно».", history: "Старая конструкция go + adjective (go bad, go crazy). Глагол go обозначает переход в состояние." },
  { phrase: "come on", time: "02:13", translation: "давай / да ладно", context: "Lloyd, come on. Let's do shots.", contextTranslation: "Ллойд, давай. Накатим по шоту.", literalTranslation: "«идти на, наступать».", history: "От буквального «приближаться, наступать» (come on stage). В разговорной речи XX века стало общим побуждением «давай!» или возгласом несогласия." },
  { phrase: "tip off", time: "02:36", translation: "подсказать, слить инфу", context: "Bartender tipped me off.", contextTranslation: "Бармен мне подсказал.", literalTranslation: "«отщёлкнуть кончик».", history: "От слова tip (намёк, подсказка) — изначально торговый сленг XIX века: дать «кончик» информации. Часто в криминальном контексте." },
  { phrase: "come over", time: "03:02", translation: "подойти", context: "It looked like you were going to come over to me.", contextTranslation: "Казалось, ты сейчас подойдёшь ко мне.", literalTranslation: "«идти через, поверх».", history: "Over подразумевает преодоление пространства. Используется со староанглийского для движения через расстояние к говорящему." },
  { phrase: "be wrapped up in", time: "03:30", translation: "быть поглощённым", context: "You've been wrapped up in the conventions of marriage.", contextTranslation: "Ты с головой ушла в условности брака.", literalTranslation: "«быть завёрнутым в».", history: "Метафора от «завернуть подарок» — человек как бы упакован, окутан темой и не может из неё выйти." },
  { phrase: "turn out", time: "04:23", translation: "оказаться", context: "It turned out he liked fat hookers.", contextTranslation: "Оказалось, ему нравились толстые проститутки.", literalTranslation: "«повернуть наружу».", history: "Из театрального жаргона XIX века (turn out — выходить на сцену). Со временем стало означать «обнаружиться, проявиться»." },
  { phrase: "happen upon", time: "04:31", translation: "случайно наткнуться", context: "After I happened upon his browsing history...", contextTranslation: "После того как я случайно наткнулась на его историю браузера...", literalTranslation: "«случиться на».", history: "Литературный оборот, восходит к XVI–XVII веку. Upon = on в более формальной речи. Сейчас звучит изысканно." },
  { phrase: "skip ahead", time: "05:42", translation: "перескочить вперёд", context: "Skip ahead ten years.", contextTranslation: "Перескочим вперёд на десять лет.", literalTranslation: "«прыгать вперёд».", history: "Skip — прыгать (с пропуском). Часто в нарративе: skip ahead in a movie, skip a chapter." },
  { phrase: "miss out on", time: "05:49", translation: "упустить", context: "Have I missed out on one of life's great experiences?", contextTranslation: "Не упустила ли я один из главных жизненных опытов?", literalTranslation: "«промахнуться насчёт».", history: "Out — выпасть из чего-то, on — относительно чего-то. Появилось в XIX веке как идиома о пропущенных возможностях." },
  { phrase: "take care of", time: "06:15", translation: "заботиться о", context: "No matter how well I take care of myself.", contextTranslation: "Как бы хорошо я о себе ни заботился.", literalTranslation: "«взять заботу о».", history: "Care как «забота» — древнеанглийское слово. Конструкция take care появилась в среднеанглийском." },
  { phrase: "come up with", time: "06:53", translation: "придумать", context: "When did you come up with all of that?", contextTranslation: "Когда ты всё это придумал?", literalTranslation: "«прийти вверх с».", history: "Метафора: идея «всплывает» (comes up) из глубин сознания, и ты приходишь с ней (with) к собеседнику." },
  { phrase: "work (one's) ass off", time: "08:39", translation: "пахать как проклятый", context: "You work your asses off and you dig yourselves out.", contextTranslation: "Вы пашете как проклятые и выбираетесь из ямы.", literalTranslation: "«работать так что задницу отработать».", history: "Грубая идиома XX века. Гипербола: работаешь так, что «отрабатываешь» части тела (work your fingers to the bone)." },
  { phrase: "dig (oneself) out", time: "08:39", translation: "выбраться из проблем", context: "You dig yourselves out.", contextTranslation: "Вы выкарабкиваетесь.", literalTranslation: "«выкопать себя наружу».", history: "Метафора горнодобывающего труда — выкопаться из ямы, завала, долгов. Старая англоамериканская идиома." },
  { phrase: "start out", time: "09:42", translation: "начинать (карьеру, путь)", context: "...the things that mattered when you were starting out.", contextTranslation: "...вещи, которые были важны для тебя в начале пути.", literalTranslation: "«стартовать наружу».", history: "Out здесь — выход в большой мир, начало путешествия (set out, head out). Используется с XIX века." },
  { phrase: "look up", time: "10:05", translation: "поднять взгляд", context: "You look up and realize that you've gotten there.", contextTranslation: "Ты поднимаешь голову и понимаешь, что добрался.", literalTranslation: "«смотреть вверх».", history: "Прямое значение. Также метафорически — look up в смысле «искать в справочнике»." },
  { phrase: "blow out of", time: "11:31", translation: "резко выйти из позиции", context: "Blow out of Pac-Pro, today.", contextTranslation: "Выходим из Pac-Pro сегодня же.", literalTranslation: "«выдуть наружу из».", history: "Финансовый жаргон Уолл-стрит. Blow out — резко продать всё. Появилось в трейдерском сленге 1980-х." },
  { phrase: "get dumped", time: "11:37", translation: "быть брошенным", context: "He got dumped.", contextTranslation: "Его бросили.", literalTranslation: "«быть выброшенным» (как мусор).", history: "От dump — мусорная свалка. Сленговое значение «бросить партнёра» появилось в США в середине XX века." },
  { phrase: "hold on", time: "13:03", translation: "подожди, держись", context: "Hold on. Wait. Girl? What girl?", contextTranslation: "Подожди. Стой. Какая девушка?", literalTranslation: "«держаться на».", history: "От буквального «держаться за что-то». В разговор пришло как «держись секунду, не отпускай»." },
  { phrase: "come on to", time: "13:32", translation: "приставать к", context: "She came on to me.", contextTranslation: "Она ко мне приставала.", literalTranslation: "«пойти на».", history: "Похоже на hit on, но с более выраженным сексуальным подтекстом. Появилось в США в 1960-х." },
  { phrase: "pass up (for)", time: "13:42", translation: "обойти, не повысить", context: "She was passed up for a VP slot.", contextTranslation: "Её обошли при назначении на пост VP.", literalTranslation: "«пройти мимо вверх».", history: "Up здесь — повышение по карьерной лестнице. Корпоративный сленг XX века." },
  { phrase: "wrap up", time: "15:50", translation: "заканчивать, завершать", context: "Wrapped up a little early, thought I'd come pick you up.", contextTranslation: "Закончил пораньше, решил тебя забрать.", literalTranslation: "«обернуть вверх».", history: "От буквального «упаковать (подарок)» — закрыть дело. Используется метафорически с конца XIX века." },
  { phrase: "pick (somebody) up", time: "15:50", translation: "забрать кого-то", context: "Thought I'd come pick you up.", contextTranslation: "Решил заехать за тобой.", literalTranslation: "«поднять (с земли)».", history: "От буквального «поднять» предмет. Применительно к людям — забрать на машине." },
  { phrase: "hang out", time: "15:55", translation: "тусоваться", context: "We could hang out a little.", contextTranslation: "Могли бы немного потусить.", literalTranslation: "«висеть снаружи».", history: "Из американского сленга 1950-60-х. Изначально про молодёжь, которая «висела» у магазинов. Стало означать «проводить время вместе»." },
  { phrase: "work out", time: "16:23", translation: "получаться, срабатывать", context: "How's that tutor we got you? Is she working out?", contextTranslation: "Как репетитор, которого мы тебе нашли? Подходит?", literalTranslation: "«работать наружу».", history: "Из математики/инженерии: «вычислить, решить» (work out a problem). Отсюда — «складывается, получается»." },
  { phrase: "show up", time: "17:37", translation: "появиться, прийти", context: "It's a little tricky when you show up on a day that isn't your day.", contextTranslation: "Сложновато, когда ты появляешься в день, который не твой.", literalTranslation: "«показаться вверх».", history: "Up — появление, возникновение (turn up, pop up). Американский разговорный английский XX века." },
  { phrase: "kick (somebody) out", time: "18:07", translation: "выгнать", context: "You kick me out of this place.", contextTranslation: "Ты выгнала меня из этого дома.", literalTranslation: "«выпинать наружу».", history: "От буквального «выпнуть». Грубая, но очень распространённая идиома: kick out of school, kick out of the band." },
  { phrase: "stick to", time: "18:57", translation: "придерживаться", context: "Try sticking to Tuesdays.", contextTranslation: "Постарайся придерживаться вторников.", literalTranslation: "«прилипать к».", history: "От stick — клеиться, прилипать. Метафора: ты как бы «прилеплен» к плану, расписанию." },
  { phrase: "fuck off", time: "20:00", translation: "проваливать", context: "Okay, fuck off, Jake. Fuck right off.", contextTranslation: "Ладно, проваливай, Джейк. Вали отсюда.", literalTranslation: "«отъебись».", history: "Грубейшее восклицание британского происхождения, XIX век. Off = «прочь». Самый распространённый английский «посыл»." },
  { phrase: "stick around", time: "20:32", translation: "задержаться, остаться", context: "Why don't you stick around?", contextTranslation: "Чего бы тебе не остаться?", literalTranslation: "«прилипнуть вокруг».", history: "Американский сленг начала XX века. Around подчёркивает «здесь, рядом». Часто: stick around for a while." },
  { phrase: "cut out", time: "20:54", translation: "вырезать", context: "...and cut out my own heart.", contextTranslation: "...и вырезать собственное сердце.", literalTranslation: "«отрезать наружу».", history: "Прямое значение. Также: cut it out! = «прекрати!» — ещё один разговорный смысл." },
  { phrase: "make up for", time: "22:27", translation: "компенсировать, наверстать", context: "She'd been making up for lost time.", contextTranslation: "Она навёрстывала упущенное время.", literalTranslation: "«сделать вверх за».", history: "От make up = «составить, дополнить». For = за, ради. Идиома XVIII века: дополнить недостающее." },
  { phrase: "get rid of", time: "23:16", translation: "избавиться от", context: "You can't get rid of me fast enough.", contextTranslation: "Не можешь меня выпроводить достаточно быстро.", literalTranslation: "«получить освобождение от».", history: "Rid — древнее слово (от древнескандинавского rythja — очищать). Конструкция get rid of закрепилась в XVI веке." },
  { phrase: "go on (with)", time: "23:25", translation: "продолжаться, происходить", context: "Something was going on with your kids.", contextTranslation: "Что-то происходит с твоими детьми.", literalTranslation: "«идти на/вперёд».", history: "Древняя конструкция. On = продолжение. What's going on? — стандартный разговорный оборот." },
  { phrase: "bring in", time: "24:32", translation: "привести / нанять", context: "I could bring half that book over here. Just bring me in.", contextTranslation: "Я мог бы привести половину портфеля. Просто возьми меня к себе.", literalTranslation: "«принести внутрь».", history: "В бизнес-сленге Уолл-стрит — «нанять, переманить». Также: bring in revenue (приносить доход)." },
  { phrase: "piss (somebody) off", time: "24:53", translation: "разозлить", context: "I can't afford to piss Jack off.", contextTranslation: "Я не могу позволить себе разозлить Джека.", literalTranslation: "«мочиться прочь от».", history: "Грубый сленг XX века. Piss как глагол стало универсальным усилителем (pissed off, pissed drunk)." },
  { phrase: "let (something) fade", time: "25:15", translation: "дать утихнуть", context: "You let the stink fade 'cause no one's gonna touch you right now.", contextTranslation: "Дай запаху скандала улетучиться — сейчас тебя никто не тронет.", literalTranslation: "«дать поблекнуть».", history: "Fade — постепенно исчезать (от старофранцузского fader). Часто: let it fade, fade away." },
  { phrase: "reach out to", time: "25:19", translation: "связаться с", context: "You should reach out to one of the new family offices.", contextTranslation: "Тебе стоит связаться с одним из новых семейных офисов.", literalTranslation: "«протянуть руку наружу к».", history: "Корпоративный английский 1980-х превратил буквальный жест в «связаться» (звонок, имейл). Сейчас — клише делового английского." },
  { phrase: "come out of", time: "25:19", translation: "выходить из, появляться из", context: "Family offices coming out of Dubai.", contextTranslation: "Семейные офисы из Дубая.", literalTranslation: "«выходить наружу из».", history: "Прямое значение, used since Old English. Также: coming out (раскрытие ориентации)." },
  { phrase: "hang (somebody) out", time: "27:18", translation: "подставить", context: "Why Jack would hang me out like that.", contextTranslation: "Почему Джек так меня подставил.", literalTranslation: "«вывесить наружу».", history: "Сокращение от hang someone out to dry — оставить «сушиться» как бельё. Идиома XX века." },
  { phrase: "cut loose", time: "27:23", translation: "избавиться от", context: "Jack saw a way to cut you loose and keep your book.", contextTranslation: "Джек увидел способ избавиться от тебя и оставить себе твой портфель.", literalTranslation: "«отрезать в свободу».", history: "Морская идиома: отрубить швартовы, чтобы судно ушло «на свободу». В переносном смысле — расстаться с кем-то." },
  { phrase: "hit on", time: "27:32", translation: "клеить, заигрывать", context: "She hit on me.", contextTranslation: "Она ко мне подкатила.", literalTranslation: "«ударить по».", history: "Американский сленг 1950-х из джаз-сцены. Hit on = «попасть в, наткнуться на» → «обратить внимание на сексуально»." },
  { phrase: "go up against", time: "28:23", translation: "выступить против", context: "I can't afford to go up against those guys.", contextTranslation: "Я не могу позволить себе выступить против этих ребят.", literalTranslation: "«идти вверх против».", history: "Спортивная метафора: подняться на ринг против соперника. Up подчёркивает противостояние лицом к лицу." },
  { phrase: "get hammered", time: "28:36", translation: "получить по полной", context: "You got hammered last year on tech stocks.", contextTranslation: "Тебя в прошлом году разнесло на техно-акциях.", literalTranslation: "«быть забитым молотком».", history: "Двойное значение: 1) сильно напиться (XX век, AmE); 2) понести большие убытки (биржевой сленг)." },
  { phrase: "put (somebody) on the spot", time: "30:08", translation: "поставить в неловкое положение", context: "I shouldn't have put you on the spot like that.", contextTranslation: "Не стоило мне ставить тебя в такое положение.", literalTranslation: "«поставить на пятно/место».", history: "Spot = точка на полу под лучом света для допроса/выступления. Идиома 1920-х из американского сленга." },
  { phrase: "eat (the cost)", time: "30:13", translation: "взять расходы на себя", context: "I'll eat the tables and take your name off the list.", contextTranslation: "Я оплачу столы сам и вычеркну твоё имя.", literalTranslation: "«съесть» (стоимость).", history: "Бизнес-сленг: eat the loss, eat the cost — поглотить убыток. Метафора от «проглотить» что-то невкусное." },
  { phrase: "get away", time: "31:43", translation: "вырваться (отдохнуть)", context: "We have to get away with the kids.", contextTranslation: "Нам надо вырваться куда-то с детьми.", literalTranslation: "«выбраться прочь».", history: "Туристический оборот XX века: get away from it all = сбежать от всего. Часто в рекламе курортов." },
  { phrase: "be on top of each other", time: "32:20", translation: "быть друг у друга на голове", context: "We're not on top of each other.", contextTranslation: "Чтобы мы не сидели друг у друга на голове.", literalTranslation: "«быть на верху друг друга».", history: "Прямое значение от тесноты — «лежим один на другом». Метафора для излишне близкого общения." },
  { phrase: "cut (somebody) off", time: "33:15", translation: "перебить, прервать; отрезать", context: "That's it. I'm cutting you off.", contextTranslation: "Всё, я тебя отрубаю (хватит пить/говорить).", literalTranslation: "«отрезать прочь».", history: "Многозначно: перебить в разговоре; отрезать от наследства; перестать наливать в баре." },
  { phrase: "take this", time: "38:22", translation: "принять (звонок)", context: "I gotta take this. Hey.", contextTranslation: "Мне надо ответить. Алло.", literalTranslation: "«взять это».", history: "Сокращение от take this call. Стандартное выражение в эпоху мобильных." },
  { phrase: "blow through", time: "39:14", translation: "пробить, прорваться", context: "I could blow through the ceiling.", contextTranslation: "Я бы пробил потолок.", literalTranslation: "«продуть сквозь».", history: "Военная метафора (артиллерия). Также — быстро тратить деньги (blow through cash)." },
  { phrase: "give up", time: "41:02", translation: "отказаться от, сдаться", context: "I might need you to give up the apartment.", contextTranslation: "Возможно, тебе придётся отказаться от квартиры.", literalTranslation: "«отдать вверх».", history: "Старая конструкция (give up the ghost = испустить дух). Up подчёркивает полную капитуляцию." },
  { phrase: "move back in (with)", time: "41:02", translation: "переехать обратно к", context: "Move back in with Mom and Dad.", contextTranslation: "Переехать обратно к маме с папой.", literalTranslation: "«двигаться назад внутрь».", history: "Move in with = заехать к кому-то жить. Back добавляет идею возврата. Очень частотно в современном AmE." },
  { phrase: "smell like ass", time: "41:17", translation: "вонять отвратительно", context: "This car smells like ass.", contextTranslation: "В этой машине воняет как из задницы.", literalTranslation: "«пахнуть как задница».", history: "Грубый сленг США. Like ass — универсальный усилитель неприятного состояния (look like ass, feel like ass)." },
  { phrase: "withdraw a complaint", time: "42:00", translation: "отозвать жалобу", context: "Can you please withdraw your complaint?", contextTranslation: "Не могла бы ты отозвать жалобу?", literalTranslation: "«отозвать жалобу».", history: "Юридический термин. Withdraw — от лат. retrahere (тянуть назад). С XV века в правовом контексте." },
  { phrase: "file a complaint", time: "42:16", translation: "подать жалобу", context: "I never filed a complaint.", contextTranslation: "Я никогда не подавала жалобу.", literalTranslation: "«подшить жалобу».", history: "File — буквально «подшить документ в папку». Идёт от средневекового делопроизводства." },
  { phrase: "start (somebody) up", time: "43:38", translation: "завести (мотор)", context: "Okay, start her up.", contextTranslation: "Давай, заводи её.", literalTranslation: "«запустить вверх».", history: "Автомобильный сленг. Машину часто называют «she/her» в разговорной речи. Up = активация." },
  { phrase: "find (one's) way", time: "45:42", translation: "найти свой путь", context: "I am. I'm finding my way.", contextTranslation: "Я в порядке. Я ищу свой путь.", literalTranslation: "«находить свой путь».", history: "Древняя метафора жизни как путешествия. Find one's way home — буквально и метафорически." },
  { phrase: "come by", time: "46:10", translation: "заскочить", context: "Thanks for coming by.", contextTranslation: "Спасибо, что заскочил.", literalTranslation: "«пройти рядом».", history: "By = мимо, рядом. Идея: «проходил мимо и заскочил». Также: come by = раздобыть." },
  { phrase: "move on", time: "47:17", translation: "двигаться дальше, отпустить прошлое", context: "I've moved on to that.", contextTranslation: "Я уже перешла к этому.", literalTranslation: "«двигаться дальше».", history: "Идиома эпохи терапии и self-help: move on after a breakup. Очень популярна с 1990-х." },
  { phrase: "boil down to", time: "49:52", translation: "сводиться к", context: "Life boils down to a series of interconnected decisions.", contextTranslation: "Жизнь сводится к череде взаимосвязанных решений.", literalTranslation: "«увариваться вниз до».", history: "Кулинарная метафора: уваривать жидкость, пока не останется суть. Используется с XIX века." },
  { phrase: "look after", time: "51:27", translation: "присматривать за", context: "You merely look after it for the next generation.", contextTranslation: "Вы просто храните их для следующего поколения.", literalTranslation: "«смотреть за/после».", history: "After здесь = «вслед за», то есть наблюдать. BrE предпочитает look after, AmE — take care of." },
  { phrase: "come up", time: "51:19", translation: "возникнуть, понадобиться", context: "Water-resistant up to 30 meters, like that will ever come up.", contextTranslation: "Водонепроницаемые до 30 метров — как будто это когда-нибудь пригодится.", literalTranslation: "«подняться вверх».", history: "Метафора: что-то «всплывает» — тема, проблема, ситуация. Очень частотный фразовый глагол." },
  { phrase: "pull into", time: "52:34", translation: "заехать в", context: "I told him to pull it into the garage.", contextTranslation: "Я сказал ему загнать машину в гараж.", literalTranslation: "«потянуть внутрь».", history: "Pull часто используется про вождение (pull over, pull up, pull out). Идея: «руль тянет машину» в нужное место." },
  { phrase: "check in", time: "52:29", translation: "проверить, заглянуть", context: "Figured we'd check in.", contextTranslation: "Решили заглянуть проверить.", literalTranslation: "«отметить внутри».", history: "От гостиничного check in. Стало означать «выйти на связь, проверить, всё ли в порядке»." },
  { phrase: "call (it) in", time: "52:39", translation: "позвонить и сообщить", context: "Your wife must've given you the wrong date when she called it in.", contextTranslation: "Ваша жена, наверное, неправильную дату назвала, когда звонила сообщить.", literalTranslation: "«позвать внутрь».", history: "Из полицейского/диспетчерского сленга: «передать инфу по рации». Сейчас — любой звонок-уведомление." },
  { phrase: "lie around", time: "53:25", translation: "валяться", context: "Piles of forgotten wealth just lying around in drawers.", contextTranslation: "Груды забытого богатства просто валяются по ящикам.", literalTranslation: "«лежать вокруг».", history: "Around = повсюду. Подчёркивает беспорядок и бесцельность пребывания вещи." },
  { phrase: "max out", time: "53:50", translation: "исчерпать лимит", context: "A maxed out home equity line.", contextTranslation: "Кредитная линия под залог дома, выбранная до предела.", literalTranslation: "«вывести в максимум».", history: "Современный финансовый и геймерский сленг: max out a credit card. Образовалось в 1970-80-х." },
  { phrase: "get back on (one's) feet", time: "54:11", translation: "снова встать на ноги", context: "Until I got back on my feet.", contextTranslation: "Пока я снова не встану на ноги.", literalTranslation: "«вернуться обратно на ноги».", history: "Восходит к боксу: после нокдауна спортсмен встаёт. Метафора восстановления после жизненного удара." }
];

// ============= IDIOMS =============
const idioms = [
  { phrase: "out of the corner of (one's) eye", time: "01:56", translation: "краем глаза", context: "Catch a fleeting glimpse, out of the corner of my eye.", contextTranslation: "Поймать мимолётный взгляд краем глаза.", literalTranslation: "«из угла глаза».", history: "Древняя идиома, прямой перевод: периферийное зрение, угол глаза. Существует во многих языках в похожей форме." },
  { phrase: "a hot mess", time: "01:58", translation: "полный бардак, хаос", context: "...the swirling hot mess of my life.", contextTranslation: "...закружившийся хаос моей жизни.", literalTranslation: "«горячий беспорядок».", history: "Идиома южных штатов США XIX века. Изначально — буквально «горячая каша». В 2000-х стала вирусной благодаря поп-культуре." },
  { phrase: "how the hell", time: "02:00", translation: "как, чёрт возьми", context: "How the hell everything could go so wrong so fast.", contextTranslation: "Как, чёрт возьми, всё могло пойти так не так и так быстро.", literalTranslation: "«как ад».", history: "The hell как усилитель в вопросах — разговорное смягчение более грубых форм. С XIX века популярно в АмE." },
  { phrase: "have no game", time: "03:11", translation: "не уметь клеить, нет харизмы", context: "I'm afraid I don't have much game.", contextTranslation: "Боюсь, я не очень умею в эти игры.", literalTranslation: "«не иметь игры».", history: "Game в значении «навыки соблазнения» — из афроамериканского сленга 1970-80-х (хип-хоп культура). Сейчас мейнстрим." },
  { phrase: "different strokes", time: "04:24", translation: "у каждого свой вкус", context: "Different strokes.", contextTranslation: "У каждого свои причуды.", literalTranslation: "«разные удары/гребки».", history: "Сокращение от Different strokes for different folks — фраза, популяризированная Мухаммедом Али в 1960-х. Также — название культового ситкома 1978 года." },
  { phrase: "by and large", time: "04:50", translation: "в общем и целом", context: "By and large, guys your age are idiots.", contextTranslation: "В целом, парни твоего возраста — идиоты.", literalTranslation: "«у ветра и в полную ширь» (морск.).", history: "Морская идиома XVII века: by — плыть круто к ветру, large — с попутным. Оба варианта = в любых условиях, то есть «в целом»." },
  { phrase: "out of (one's) depth", time: "04:59", translation: "не по зубам, не в своей лиге", context: "Narcissistic man-boys far out of their depth with you.", contextTranslation: "Нарциссы-мальчишки, которым ты не по зубам.", literalTranslation: "«вне своей глубины».", history: "Морская/пловцовая метафора: ушёл туда, где дна не достать. Используется с XIX века для ситуаций, где не хватает компетенции." },
  { phrase: "in the moment", time: "05:29", translation: "в моменте, здесь и сейчас", context: "You live your life in the moment.", contextTranslation: "Ты живёшь моментом.", literalTranslation: "«в моменте».", history: "Из театрального жаргона (актёрская техника Станиславского). С 1990-х мейнстрим, особенно в контексте mindfulness." },
  { phrase: "kick it", time: "06:22", translation: "сыграть в ящик (умереть)", context: "What your life looks like after I kick it.", contextTranslation: "Как будет выглядеть твоя жизнь после того, как я отброшу копыта.", literalTranslation: "«пнуть это».", history: "Сокращение от kick the bucket. Происхождение спорно: либо повешение (выбивали ведро из-под ног), либо средневековый забой свиней." },
  { phrase: "get laid", time: "07:05", translation: "переспать с кем-то", context: "Honestly, man, I was just looking to get laid.", contextTranslation: "Если честно, я просто хотел перепихнуться.", literalTranslation: "«быть уложенным».", history: "Lay = положить (в т.ч. в постель). Грубый сленг США 1930-х. Get laid = пассивное «быть уложенным», т.е. получить секс." },
  { phrase: "come to mind", time: "07:14", translation: "приходить на ум", context: "None come to mind.", contextTranslation: "Ни одна не приходит в голову.", literalTranslation: "«прийти в ум».", history: "Mind как «вместилище мыслей» — древнегерманская концепция. Идиома существует с XIV века." },
  { phrase: "right out of college", time: "08:01", translation: "сразу после колледжа", context: "You land a job right out of college at a major firm.", contextTranslation: "Ты получаешь работу сразу после колледжа в крупной фирме.", literalTranslation: "«прямо из колледжа».", history: "Right здесь = «прямо, сразу». Стандартный американский корпоративный нарратив о начале карьеры." },
  { phrase: "a cog in a wheel", time: "08:04", translation: "винтик в системе", context: "You're just another cog in a very large wheel.", contextTranslation: "Ты просто очередной винтик в огромном колесе.", literalTranslation: "«зубец в колесе».", history: "Промышленная метафора XIX века: в фабричных шестернях каждый зубец важен, но взаимозаменяем. Стало символом обезличенности." },
  { phrase: "get a foot in the door", time: "08:05", translation: "пробиться, зацепиться", context: "You've got your foot in the door.", contextTranslation: "Ты уже зацепился (получил шанс).", literalTranslation: "«вставить ногу в дверь».", history: "От практики коммивояжёров XIX–XX веков: они вставляли ногу в дверь, чтобы хозяйка не закрыла её. Стало символом первого шага." },
  { phrase: "dead broke", time: "08:22", translation: "без копейки", context: "You're dead broke, but there's two of you now.", contextTranslation: "Вы без гроша, но теперь вас двое.", literalTranslation: "«мертвецки сломленный».", history: "Dead как усилитель (dead tired, dead serious). Broke = «сломленный» в финансовом смысле — англ. сленг XVII века." },
  { phrase: "in it together", time: "08:24", translation: "быть в этом вместе", context: "You're in it together and that feels good.", contextTranslation: "Вы в этом вместе, и это приятно.", literalTranslation: "«быть в этом вместе».", history: "Прямое выражение солидарности. Использовалось в военной риторике и стало популярным мемом во время COVID-19." },
  { phrase: "big bucks", time: "09:11", translation: "большие деньги", context: "You start earning some big bucks.", contextTranslation: "Ты начинаешь зарабатывать большие бабки.", literalTranslation: "«большие самцы».", history: "Buck = доллар. Происхождение: в колониальной Америке шкуры оленя-самца использовались как валюта в торговле с индейцами." },
  { phrase: "a fancy way of saying", time: "09:29", translation: "красивый способ сказать", context: "A fancy way of saying you've got something to show for your efforts.", contextTranslation: "Красивый способ сказать, что у тебя есть что показать.", literalTranslation: "«вычурный способ говорить».", history: "Fancy = вычурный, нарядный. Используется иронично: «громкое слово вместо простого». XIX век." },
  { phrase: "lose sight of", time: "09:38", translation: "упустить из виду", context: "You've lost sight of whatever naive plans you may have once had.", contextTranslation: "Ты потерял из виду те наивные планы, что когда-то имел.", literalTranslation: "«потерять зрение чего-то».", history: "Морская идиома: lose sight of land — потерять землю из виду. С XV века метафорически о целях." },
  { phrase: "what's the point", time: "09:49", translation: "в чём смысл", context: "Really, what's the point of all this shit?", contextTranslation: "В чём вообще смысл всей этой херни?", literalTranslation: "«в чём суть/острие».", history: "Point — буквально кончик/острие, метафорически «суть». Используется с XIV века." },
  { phrase: "speaking of which", time: "12:39", translation: "кстати говоря", context: "Speaking of which, I gotta deliver some bad news.", contextTranslation: "Кстати говоря, у меня плохие новости.", literalTranslation: "«говоря о чём».", history: "Стандартный связочный оборот английского с XIX века. Используется в профессиональной и разговорной речи." },
  { phrase: "in good shape", time: "12:45", translation: "в хорошем состоянии/форме", context: "My sole remaining testicle is in good shape.", contextTranslation: "Моё единственное оставшееся яичко в хорошей форме.", literalTranslation: "«в хорошей форме».", history: "Спортивная метафора, популярная с 1920-х. Применима к делам, машинам, отношениям." },
  { phrase: "the thing of it is", time: "12:50", translation: "дело в том, что", context: "The thing of it is, Coop, you're fired.", contextTranslation: "Дело в том, Куп, что ты уволен.", literalTranslation: "«вещь этого есть».", history: "Разговорный AmE-оборот для подведения к неприятной правде. The thing is — короче." },
  { phrase: "you know the drill", time: "14:05", translation: "ты знаешь процедуру", context: "Proprietary information, you know the drill.", contextTranslation: "Конфиденциальная информация, ты знаешь как это бывает.", literalTranslation: "«ты знаешь учения».", history: "Drill = военная муштра, тренировка. Идиома пошла из армии: «знаешь, как это делается». Закрепилась в XX веке." },
  { phrase: "no way", time: "14:20", translation: "ни за что", context: "Everything I have is in that account. ... No way.", contextTranslation: "Всё, что у меня есть, — на этом счёте. ... Ни за что.", literalTranslation: "«никак».", history: "Краткое отрицание, появилось в АмЕ начала XX века. No way, José — рифмованный вариант 1970-х." },
  { phrase: "for cause", time: "14:22", translation: "по уважительной причине (об увольнении)", context: "You were fired for cause.", contextTranslation: "Тебя уволили по статье.", literalTranslation: "«по причине».", history: "Юридический термин трудового права США. Fired for cause = уволен за нарушение, без выплаты компенсации." },
  { phrase: "play that card", time: "17:49", translation: "разыгрывать ту карту", context: "When are you gonna stop playing that card?", contextTranslation: "Когда ты перестанешь разыгрывать эту карту?", literalTranslation: "«играть ту карту».", history: "Карточная метафора: «разыгрывать козырь». Часто: race card, victim card — обвинение в манипуляции." },
  { phrase: "statute of limitations", time: "17:52", translation: "срок давности", context: "What is the statute of limitations on adultery?", contextTranslation: "Какой срок давности у измены?", literalTranslation: "«закон ограничений».", history: "Латинский юридический термин: statutum limitationum. В разговоре часто иронично: «когда уже можно перестать вспоминать?»." },
  { phrase: "the sad cuckold", time: "17:55", translation: "несчастный рогоносец", context: "Less time than you've spent playing the sad cuckold.", contextTranslation: "Меньше, чем ты разыгрываешь несчастного рогоносца.", literalTranslation: "«грустный рогоносец».", history: "Cuckold — от cuckoo (кукушка), которая подбрасывает яйца в чужие гнёзда. Слово известно с XIII века в английском." },
  { phrase: "in a vacuum", time: "18:02", translation: "в вакууме, изолированно", context: "These things don't happen in a vacuum.", contextTranslation: "Такое не происходит в вакууме.", literalTranslation: "«в вакууме».", history: "Научная метафора: вакуум как изолированная среда. Используется с конца XIX века в значении «без контекста»." },
  { phrase: "my bad", time: "19:14", translation: "моя вина (виноват)", context: "That is totally my bad, man.", contextTranslation: "Это полностью моя вина, чувак.", literalTranslation: "«мой плохой».", history: "Американский сленг 1970-80-х из баскетбольной культуры. В 2000-е стала повсеместной благодаря фильму «Дрянные девчонки»." },
  { phrase: "I feel you", time: "21:02", translation: "понимаю тебя", context: "Look, I get it, Coop. I feel you, man.", contextTranslation: "Слушай, я понимаю, Куп. Я тебя чувствую, бро.", literalTranslation: "«я тебя чувствую».", history: "Афроамериканский разговорный английский, вошедший в мейнстрим через хип-хоп в 1990-х. Эмоциональнее, чем I understand." },
  { phrase: "good luck with that", time: "21:08", translation: "удачи тебе с этим (часто иронично)", context: "Yeah, good luck with that.", contextTranslation: "Ага, удачи тебе с этим.", literalTranslation: "«удачи с этим».", history: "Внешне доброжелательная фраза, в современном AmE почти всегда саркастична — выражает скептицизм." },
  { phrase: "sleep like a log", time: "21:28", translation: "спать как убитый", context: "Haskell slept like a log.", contextTranslation: "Хаскелл спал как бревно.", literalTranslation: "«спать как бревно».", history: "Сравнение со старого английского: log = тяжёлое, неподвижное бревно. Аналог в русском — «спать как убитый»." },
  { phrase: "make (one's) fortune", time: "22:17", translation: "сколотить состояние", context: "Paul made his fortune in diners.", contextTranslation: "Пол сколотил состояние на закусочных.", literalTranslation: "«сделать своё состояние».", history: "Fortune = и судьба, и богатство. Идиома из эпохи «американской мечты» XIX века." },
  { phrase: "make up for lost time", time: "22:27", translation: "наверстать упущенное", context: "She'd been making up for lost time.", contextTranslation: "Она навёрстывала упущенное время.", literalTranslation: "«дополнить за потерянное время».", history: "Идиома XIX века. Часто — после развода, болезни, тюрьмы: догонять то, что пропустил." },
  { phrase: "off-putting", time: "23:34", translation: "отталкивающий", context: "It's just a little off-putting if I'm being honest.", contextTranslation: "Если честно, это слегка отталкивает.", literalTranslation: "«сбивающий с пути».", history: "Британский английский XIX века: put off = откладывать, отталкивать. Off-putting описывает то, что заставляет отстраниться." },
  { phrase: "on and off", time: "24:20", translation: "с перерывами", context: "We'd been doing this on and off for half a year.", contextTranslation: "Мы этим занимались с перерывами полгода.", literalTranslation: "«вкл и выкл».", history: "Метафора выключателя. Применяется к отношениям, привычкам. Старо как электричество." },
  { phrase: "stick the landing", time: "24:23", translation: "успешно завершить", context: "I had yet to stick the landing.", contextTranslation: "Мне всё ещё не удавалось довести дело до конца.", literalTranslation: "«приклеить приземление».", history: "Из спортивной гимнастики: «приземлиться без шага» — высший балл. Метафора любого успешного завершения. Популярно с Олимпиад 1980-х." },
  { phrase: "win-win", time: "24:34", translation: "беспроигрышный вариант", context: "It's a win-win.", contextTranslation: "Это беспроигрышный вариант.", literalTranslation: "«победа-победа».", history: "Из теории игр и переговорных тренингов 1970-х (Гарвардская школа). Стало клише корпоративного английского." },
  { phrase: "make it worth (one's) while", time: "25:08", translation: "хорошо отблагодарить", context: "Well, they made it worth my while.", contextTranslation: "Что ж, они хорошо мне за это заплатили.", literalTranslation: "«сделать это стоящим времени».", history: "Worth one's while = стоящее затраченного времени. Идиома Шекспировской эпохи." },
  { phrase: "bring (somebody) in cold", time: "25:13", translation: "принять без подготовки", context: "I can't bring you in cold.", contextTranslation: "Я не могу взять тебя без подготовки.", literalTranslation: "«ввести холодным».", history: "Cold здесь = «без подготовки», как в cold call (холодный звонок). Идиома деловой среды." },
  { phrase: "give a shit", time: "25:22", translation: "наплевать (грубо)", context: "They won't give a shit about your non-solicit.", contextTranslation: "Им будет плевать на твоё non-solicit.", literalTranslation: "«дать дерьма».", history: "Грубая идиома XX века. Образована по модели вежливого give a damn (XIX век, прославившегося в Gone with the Wind)." },
  { phrase: "Team Coop", time: "26:08", translation: "команда Купа (на твоей стороне)", context: "Hey, I'm on Team Coop.", contextTranslation: "Эй, я в команде Купа.", literalTranslation: "«Команда Купа».", history: "Современный мем: \"Team [имя]\" = «я за [имени]». Произошло от Twilight (2008) — Team Edward / Team Jacob. Стало универсальным." },
  { phrase: "cut the shit", time: "26:56", translation: "хватит трепаться, кончай", context: "There comes a time when a man has to cut the shit.", contextTranslation: "Приходит время, когда мужик должен прекратить нести чушь.", literalTranslation: "«отрезать дерьмо».", history: "Грубый AmE-сленг. Cut здесь = прекратить (cut the crap). Используется когда устали слушать отговорки." },
  { phrase: "borderline at best", time: "27:21", translation: "в лучшем случае на грани", context: "It was borderline at best.", contextTranslation: "В лучшем случае это было пограничным случаем.", literalTranslation: "«пограничное в лучшем случае».", history: "Borderline (от пограничной линии) — на грани приемлемого. At best = «и это ещё максимум положительного»." },
  { phrase: "off the top of (one's) head", time: "28:18", translation: "навскидку", context: "...not to mention your sister, and that's just off the top of my head.", contextTranslation: "...не говоря уже о твоей сестре, и это только навскидку.", literalTranslation: "«с верхушки головы».", history: "Идиома середины XX века. Идея: первое, что приходит в голову, без раздумий и подготовки." },
  { phrase: "no dice", time: "28:48", translation: "без шансов", context: "Lance too. No dice?", contextTranslation: "И Лэнс тоже. Без шансов?", literalTranslation: "«нет костей».", history: "Из азартного сленга США 1920-х. В 1930-х суды отказывались признавать незаконные броски — «нет костей» = «не считается»." },
  { phrase: "smorgasbord", time: "29:40", translation: "богатый выбор, изобилие", context: "It's gotta be a goddamn smorgasbord of ass out there.", contextTranslation: "Там должно быть охренительное изобилие задниц.", literalTranslation: "«шведский стол».", history: "Шведское смÖргосбурд — буквально «бутербродный стол». Вошло в английский в 1939 году после Нью-Йоркской всемирной выставки." },
  { phrase: "news from the front", time: "29:44", translation: "новости с передовой", context: "Come on, give me something. Some news from the front.", contextTranslation: "Ну, расскажи мне что-нибудь. Какие новости с передовой?", literalTranslation: "«новости с фронта».", history: "Военная метафора Первой мировой войны. Используется иронично про любые новости." },
  { phrase: "pencil (somebody) in", time: "29:51", translation: "ориентировочно вписать", context: "I penciled you in for two tables.", contextTranslation: "Я ориентировочно записал тебя на два стола.", literalTranslation: "«вписать карандашом».", history: "Карандашом — то, что можно стереть, в отличие от чернил. Идиома XX века в деловом английском." },
  { phrase: "a chance in hell", time: "33:03", translation: "ни малейшего шанса", context: "Not a chance in hell, but thanks for asking.", contextTranslation: "Ни малейшего шанса, но спасибо, что спросила.", literalTranslation: "«шанс в аду».", history: "Гипербола: даже в аду нет шансов. Используется с XIX века. Часто в форме отрицания." },
  { phrase: "time will tell", time: "33:33", translation: "время покажет", context: "Time will tell how fucked up our kids are gonna be.", contextTranslation: "Время покажет, насколько искалеченными вырастут наши дети.", literalTranslation: "«время скажет».", history: "Древняя пословица, восходит к Овидию (\"tempus omnia revelat\"). В английском с XVI века." },
  { phrase: "for God's sake", time: "37:55", translation: "ради Бога", context: "For God's sake!", contextTranslation: "Ради Бога!", literalTranslation: "«ради Божьего блага».", history: "Sake = благо, польза. Религиозное по форме, но используется как восклицание досады. С XV века." },
  { phrase: "the real thing", time: "38:43", translation: "настоящее, неподдельное", context: "Looks like the real thing.", contextTranslation: "Выглядит как настоящее.", literalTranslation: "«настоящая вещь».", history: "Знаменитый рекламный слоган Coca-Cola \"It's the Real Thing\" (1969) сделал фразу культовой. В сцене звучит Radiohead — Fake Plastic Trees." },
  { phrase: "off (one's) meds", time: "39:38", translation: "не принимать таблетки", context: "You off your meds again?", contextTranslation: "Ты опять без таблеток?", literalTranslation: "«вне своих лекарств».", history: "Психиатрический сленг США. Meds = medications. Часто говорится про людей с биполярным расстройством." },
  { phrase: "I make no promises", time: "41:12", translation: "ничего не обещаю", context: "I make no promises.", contextTranslation: "Ничего не обещаю.", literalTranslation: "«я не делаю обещаний».", history: "Стандартный английский оборот ухода от ответственности. Часто как ответ на просьбу что-то сделать." },
  { phrase: "(one's) hands are tied", time: "42:43", translation: "у меня связаны руки", context: "My hands were tied.", contextTranslation: "У меня были связаны руки.", literalTranslation: "«мои руки связаны».", history: "Древняя метафора: связанный человек не может действовать. В корпоративном английском — стандартное оправдание." },
  { phrase: "be insulated from", time: "50:20", translation: "быть отгороженным от", context: "You start to feel insulated from the rest of the world.", contextTranslation: "Ты начинаешь чувствовать себя отгороженным от остального мира.", literalTranslation: "«быть изолированным от».", history: "Insulate — от лат. insula (остров). Электрическая метафора (изоляция провода) перешла в социальную." },
  { phrase: "get complacent", time: "50:23", translation: "потерять бдительность", context: "You get complacent about things like alarm systems.", contextTranslation: "Ты теряешь бдительность к таким вещам, как сигнализация.", literalTranslation: "«стать благодушным».", history: "Complacent — от лат. complacere (доставлять удовольствие). Изначально нейтральное «довольный», но с XIX века — самоуспокоенность." },
  { phrase: "bright and early", time: "52:37", translation: "очень рано", context: "Bright and early tomorrow morning.", contextTranslation: "Завтра рано-рано утром.", literalTranslation: "«ярко и рано».", history: "Идиома XIX века: bright = с восходом солнца. Альтернатива более холодной at the crack of dawn." },
  { phrase: "piles of (something)", time: "53:25", translation: "кучи чего-то", context: "Piles of forgotten wealth just lying around in drawers.", contextTranslation: "Груды забытого богатства просто валяются по ящикам.", literalTranslation: "«кучи».", history: "Pile — гора, груда. Часто гипербола: piles of money, piles of work, piles of paperwork." },
  { phrase: "in the red", time: "53:59", translation: "в минусе, в долгах", context: "A bank account that was still in the red from the divorce.", contextTranslation: "Банковский счёт, всё ещё в минусе после развода.", literalTranslation: "«в красном».", history: "Бухгалтерская традиция: убытки писали красными чернилами, прибыль — чёрными. Отсюда in the red / in the black. Пошло с XIX века." },
  { phrase: "a quick fix", time: "54:11", translation: "быстрое решение, временный костыль", context: "A quick fix to pay some bills.", contextTranslation: "Быстрое решение, чтобы оплатить счета.", literalTranslation: "«быстрая починка».", history: "Также quick fix — «быстрый укол» (наркосленг 1960-х). Стало универсальным термином для временного решения." },
  { phrase: "what's the worst that could happen", time: "54:15", translation: "что может пойти не так", context: "I figured, what's the worst that could happen?", contextTranslation: "Я подумал: ну что плохого может случиться?", literalTranslation: "«что худшее может случиться».", history: "Классический риторический вопрос — почти всегда произносится перед катастрофой. Базовый троп комедий и триллеров." }
];

// ============= VOCABULARY =============
const vocabulary = [
  // SEGMENT 1
  { word: "introspection", translation: "самоанализ", context: "I wasn't generally the kind of guy who did a lot of introspection.", time: "01:40", level: "B2" },
  { word: "fleeting", translation: "мимолётный", context: "Catch a fleeting glimpse.", time: "01:53", level: "B2" },
  { word: "swirling", translation: "закружившийся, вихрящийся", context: "The swirling hot mess of my life.", time: "01:58", level: "B2" },
  { word: "promotion", translation: "повышение", context: "Big promotion, boy!", time: "02:25", level: "B1" },
  { word: "recognize", translation: "узнать", context: "I didn't recognize you.", time: "02:50", level: "B1" },
  { word: "fanboy", translation: "фанатик, фанбой", context: "The Patrick Bateman fanboys over there.", time: "02:56", level: "C1" },
  { word: "occupied", translation: "занятой, при деле", context: "It might be better if I looked occupied.", time: "02:59", level: "B2" },
  { word: "impatient", translation: "нетерпеливый", context: "I got impatient.", time: "03:04", level: "B2" },
  { word: "single", translation: "холостой", context: "I'm recently single.", time: "03:06", level: "B1" },
  { word: "married", translation: "женат/замужем", context: "You were married?", time: "03:15", level: "B1" },
  { word: "convention", translation: "условность, традиция", context: "The conventions of marriage.", time: "03:30", level: "B2" },
  { word: "segment", translation: "сегмент, часть", context: "An entire segment of the population.", time: "03:37", level: "B2" },
  { word: "harmony", translation: "гармония", context: "Peace of mind, harmony.", time: "03:50", level: "B2" },
  { word: "achieve", translation: "достичь", context: "How many of them have you achieved?", time: "03:52", level: "B1" },
  { word: "rules", translation: "правила", context: "Maybe you should rethink the rules.", time: "03:56", level: "B1" },
  { word: "irony", translation: "ирония", context: "The irony is, I was morbidly obese.", time: "04:26", level: "B2" },
  { word: "morbidly", translation: "болезненно (о массе)", context: "I was morbidly obese as a teenager.", time: "04:26", level: "C1" },
  { word: "obese", translation: "страдающий ожирением", context: "I was morbidly obese.", time: "04:26", level: "B2" },
  { word: "narcissistic", translation: "нарциссический", context: "Narcissistic man-boys.", time: "04:59", level: "B2" },
  { word: "antidote", translation: "противоядие", context: "Looks like the perfect antidote.", time: "05:04", level: "B2" },
  { word: "freedom", translation: "свобода", context: "I have money, you have freedom.", time: "05:18", level: "B1" },
  { word: "decade", translation: "десятилетие", context: "Two decades more worth of stories.", time: "05:27", level: "B1" },
  { word: "reckless", translation: "безрассудный", context: "The kind of reckless immediacy.", time: "05:32", level: "B2" },
  { word: "shaky", translation: "шаткий", context: "Things can start to get a little shaky.", time: "05:45", level: "B2" },
  { word: "experience", translation: "опыт", context: "One of life's great experiences.", time: "05:51", level: "B1" },
  { word: "stunning", translation: "потрясающая", context: "You'll still be stunning.", time: "05:52", level: "B1" },
  { word: "prostate", translation: "простата", context: "My prostate's gonna do what it does.", time: "06:18", level: "B2" },
  { word: "insecure", translation: "неуверенный", context: "Are you that insecure?", time: "06:29", level: "B2" },
  { word: "self-esteem", translation: "самооценка", context: "A very strange mix of confidence and low self-esteem.", time: "06:38", level: "B2" },
  { word: "jealous", translation: "ревнивый", context: "I'll be the jealous, old troll.", time: "06:40", level: "B2" },
  { word: "restless", translation: "беспокойный", context: "A restless woman in her sexual prime.", time: "06:42", level: "B2" },
  { word: "consumed", translation: "поглощённый", context: "Consumed by this nagging fear.", time: "06:44", level: "B2" },
  { word: "nagging", translation: "ноющий, не дающий покоя", context: "This nagging fear.", time: "06:44", level: "B2" },
  { word: "utterly", translation: "совершенно, абсолютно", context: "Spent completely and utterly alone.", time: "06:49", level: "C1" },
  { word: "rebuttal", translation: "возражение, опровержение", context: "A full-throated rebuttal.", time: "07:02", level: "B2" },
  { word: "copacetic", translation: "всё в полном порядке", context: "When things are, you know, copacetic.", time: "08:52", level: "C1" },
  { word: "jumbo", translation: "крупный (об ипотеке)", context: "30-year jumbo at four and a half percent.", time: "09:00", level: "C1" },
  { word: "leveraged", translation: "закредитованный", context: "You're leveraged.", time: "09:29", level: "C1" },
  { word: "naive", translation: "наивный", context: "Naive plans you may have once had.", time: "09:40", level: "C1" },

  // SEGMENT 2
  { word: "hallowed", translation: "освящённый, заветный", context: "That hallowed plateau.", time: "10:07", level: "C1" },
  { word: "plateau", translation: "плато, выход на стабильность", context: "That hallowed plateau.", time: "10:07", level: "C1" },
  { word: "mystical", translation: "мистический", context: "That mystical nexus.", time: "10:11", level: "C1" },
  { word: "nexus", translation: "точка пересечения", context: "In that mystical nexus.", time: "10:11", level: "C1" },
  { word: "wrangle", translation: "усмирить, обуздать", context: "Wrangled life into submission.", time: "10:11", level: "C1" },
  { word: "submission", translation: "подчинение", context: "Wrangled life into submission.", time: "10:13", level: "C1" },
  { word: "infinitely", translation: "бесконечно", context: "Infinitely complex challenges.", time: "10:13", level: "C1" },
  { word: "depressing", translation: "удручающий", context: "It's small, but don't worry, it's also depressing.", time: "10:44", level: "B2" },
  { word: "rebound", translation: "отскочить, восстановиться", context: "They're gonna rebound.", time: "11:24", level: "B2" },
  { word: "emerging", translation: "развивающийся", context: "Emerging tech.", time: "11:29", level: "B2" },
  { word: "putz", translation: "ничтожество, идиот (идиш)", context: "She still with the putz?", time: "12:30", level: "C1" },
  { word: "testicle", translation: "яичко", context: "My sole remaining testicle is in good shape.", time: "12:45", level: "B2" },
  { word: "fired", translation: "уволен", context: "Coop, you're fired.", time: "12:50", level: "B1" },
  { word: "associate", translation: "младший сотрудник, ассоциат", context: "A managing director sleeping with an associate.", time: "13:11", level: "B2" },
  { word: "consensual", translation: "по обоюдному согласию", context: "Completely consensual.", time: "13:31", level: "B2" },
  { word: "superior", translation: "начальник", context: "You were her superior.", time: "13:34", level: "B2" },
  { word: "litigate", translation: "судиться", context: "I'm not here to litigate.", time: "13:48", level: "B2" },
  { word: "fraternizing", translation: "интимные отношения с коллегами", context: "A very strict non-fraternizing clause.", time: "13:52", level: "C1" },
  { word: "clause", translation: "пункт договора", context: "A non-fraternizing clause.", time: "13:52", level: "C1" },
  { word: "proprietary", translation: "конфиденциальная (информация)", context: "Proprietary information, you know the drill.", time: "14:05", level: "C1" },
  { word: "non-solicit", translation: "запрет переманивания клиентов", context: "According to the non-solicit you signed.", time: "14:07", level: "C1" },
  { word: "bury (somebody)", translation: "уничтожить, похоронить (карьеру)", context: "You're really gonna bury me like this?", time: "14:13", level: "C1" },
  { word: "capital account", translation: "капитальный счёт (фин.)", context: "My capital account?", time: "14:18", level: "C1" },
  { word: "draw (financial)", translation: "выплата, аванс", context: "Six months' draw.", time: "14:33", level: "B2" },
  { word: "tutor", translation: "репетитор", context: "How's that tutor we got you?", time: "16:23", level: "B1" },
  { word: "syllables", translation: "слоги", context: "An answer longer than two syllables?", time: "16:40", level: "B2" },
  { word: "boundaries", translation: "границы (отношений)", context: "Boundaries are there for a reason.", time: "17:42", level: "B2" },
  { word: "monogamy", translation: "моногамия", context: "Boundaries? You mean, like monogamy?", time: "17:45", level: "B2" },
  { word: "adultery", translation: "супружеская измена", context: "What is the statute of limitations on adultery?", time: "17:52", level: "B2" },
  { word: "cuckold", translation: "рогоносец", context: "The sad cuckold.", time: "17:55", level: "C1" },
  { word: "self-aware", translation: "осознанный, самокритичный", context: "If you were even remotely self-aware.", time: "18:00", level: "B2" },
  { word: "remotely", translation: "хоть немного, отдалённо", context: "Even remotely self-aware.", time: "18:00", level: "C1" },
  { word: "vacuum (fig.)", translation: "вакуум (переносн.)", context: "These things don't happen in a vacuum.", time: "18:02", level: "C1" },
  { word: "responsibility", translation: "ответственность", context: "Take a portion of responsibility.", time: "18:04", level: "B1" },
  { word: "warped", translation: "покоробленный", context: "It's old and warped.", time: "18:26", level: "C1" },
  { word: "dermatologist", translation: "дерматолог", context: "I took Tori to the dermatologist.", time: "18:43", level: "B2" },
  { word: "treatment", translation: "лечение", context: "She wants this new laser treatment.", time: "18:48", level: "B2" },
  { word: "invoice", translation: "счёт-фактура", context: "They're gonna email you the invoice.", time: "18:54", level: "B2" },
  { word: "ding (verb)", translation: "поцарапать, ударить", context: "I'm sorry I had to ding your car.", time: "19:29", level: "C1" },
  { word: "boyfriend", translation: "парень", context: "He's my boyfriend.", time: "19:36", level: "B1" },
  { word: "statutory", translation: "установленный законом", context: "Statutory rape.", time: "20:07", level: "C1" },

  // SEGMENT 3
  { word: "skirt steaks", translation: "стейки из диафрагмы", context: "These terrific skirt steaks I just picked up.", time: "20:28", level: "C2" },
  { word: "terrific", translation: "потрясающий", context: "These terrific skirt steaks.", time: "20:28", level: "B2" },
  { word: "backyard", translation: "задний двор", context: "Going into my backyard.", time: "20:43", level: "B1" },
  { word: "embroider", translation: "украсить, расшить", context: "Couldn't have been brighter if I'd embroidered it with neon lights.", time: "21:47", level: "C2" },
  { word: "concrete", translation: "бетон, тротуар", context: "Hoofing it down the concrete.", time: "21:42", level: "B2" },
  { word: "diner", translation: "американская закусочная", context: "Paul made his fortune in diners.", time: "22:17", level: "B2" },
  { word: "fortune", translation: "состояние, удача", context: "Made his fortune in diners.", time: "22:17", level: "B2" },
  { word: "erectile dysfunction", translation: "эректильная дисфункция", context: "A serious case of erectile dysfunction.", time: "22:22", level: "C1" },
  { word: "fake", translation: "притворяться", context: "That's how you know I wasn't faking it.", time: "22:40", level: "B1" },
  { word: "biology", translation: "биология", context: "Seriously, I mean, it's biology, right?", time: "23:21", level: "B1" },
  { word: "dopamine", translation: "дофамин", context: "The dopamine crash after the rush of orgasm.", time: "23:23", level: "B2" },
  { word: "orgasm", translation: "оргазм", context: "The rush of orgasm.", time: "23:23", level: "B2" },
  { word: "concern", translation: "беспокойство, забота", context: "Thank you so much for your concern.", time: "23:27", level: "B2" },
  { word: "misconstrue", translation: "неправильно истолковать", context: "Maybe something's getting misconstrued here.", time: "23:30", level: "B2" },
  { word: "exfoliate", translation: "сделать пилинг", context: "I got a sitter and I exfoliated.", time: "23:42", level: "B2" },
  { word: "sitter", translation: "няня (на разовую работу)", context: "I got a sitter.", time: "23:42", level: "B2" },
  { word: "book (financial)", translation: "портфель сделок", context: "I could bring half that book over here.", time: "24:32", level: "C1" },
  { word: "poach", translation: "переманивать (сотрудника)", context: "I have been wanting to poach you.", time: "24:57", level: "B2" },
  { word: "beating (we are taking)", translation: "удар, потери", context: "The beating we're taking in tech this year.", time: "24:55", level: "C1" },
  { word: "settle (legal)", translation: "урегулировать дело", context: "Bailey will settle.", time: "27:46", level: "B2" },
  { word: "alimony", translation: "алименты бывшему супругу", context: "Alimony, child support, two houses.", time: "28:14", level: "B2" },
  { word: "child support", translation: "алименты на ребёнка", context: "Alimony, child support.", time: "28:14", level: "B2" },
  { word: "nut (expenses)", translation: "ежемесячные расходы (сленг)", context: "Your nut? Six months. Seven tops.", time: "28:09", level: "C1" },
  { word: "float (financially)", translation: "продержаться", context: "How long I can float on what I got.", time: "28:03", level: "C1" },
  { word: "lehayim / l'chaim", translation: "за жизнь (тост на иврите)", context: "Lehayim.", time: "29:22", level: "C2" },

  // SEGMENT 4
  { word: "all-star", translation: "звезда (спорт.)", context: "Three-time NBA all-star.", time: "31:09", level: "B2" },
  { word: "villa", translation: "вилла", context: "I found us this villa, stunning view of the coast.", time: "32:15", level: "B1" },
  { word: "coast", translation: "побережье", context: "Stunning view of the coast.", time: "32:15", level: "B1" },
  { word: "Armageddon", translation: "Армагеддон", context: "It was like Armageddon here.", time: "32:49", level: "C1" },
  { word: "enlightened", translation: "просвещённый", context: "How we're all so enlightened.", time: "33:24", level: "C1" },
  { word: "affair", translation: "интрижка, роман", context: "Mel and Nick had an affair.", time: "33:29", level: "B2" },
  { word: "candlestick", translation: "подсвечник", context: "She was struck with a candlestick.", time: "36:23", level: "B2" },
  { word: "microscope", translation: "микроскоп", context: "Microscope.", time: "36:30", level: "B1" },
  { word: "punch", translation: "ударить кулаком", context: "Punched me in the...", time: "38:25", level: "B1" },
  { word: "loaner", translation: "временно выданная (машина)", context: "It's a loaner.", time: "40:38", level: "C1" },
  { word: "dipshit", translation: "придурок", context: "Radiohead, dipshit.", time: "40:13", level: "C1" },

  // SEGMENT 5
  { word: "trouble", translation: "проблема, беда", context: "I'm in trouble, Ali.", time: "40:56", level: "B1" },
  { word: "withdraw", translation: "отозвать", context: "Can you please withdraw your complaint?", time: "42:00", level: "B2" },
  { word: "recant", translation: "отказаться от показаний", context: "You can recant and indemnify Bailey.", time: "42:00", level: "B2" },
  { word: "indemnify", translation: "оградить от иска (юр.)", context: "Indemnify Bailey against a lawsuit.", time: "42:00", level: "B2" },
  { word: "lawsuit", translation: "судебный иск", context: "Indemnify Bailey against a lawsuit.", time: "42:00", level: "B2" },
  { word: "complaint", translation: "жалоба", context: "I never filed a complaint.", time: "42:16", level: "B1" },
  { word: "policy", translation: "политика, правила", context: "You broke company policy.", time: "42:43", level: "B2" },
  { word: "ruin", translation: "разрушить, испортить", context: "I just can't let you ruin that beautiful motor.", time: "43:35", level: "B2" },
  { word: "assault", translation: "напасть, избить", context: "You assaulted our daughter's boyfriend.", time: "44:52", level: "B2" },
  { word: "overserved", translation: "перебрал (с алкоголем)", context: "I was a little overserved.", time: "44:46", level: "C1" },
  { word: "barbecue", translation: "барбекю", context: "I'm sorry about the barbecue.", time: "44:46", level: "B1" },
  { word: "explanation", translation: "объяснение", context: "I was hoping for an explanation.", time: "46:24", level: "B1" },
  { word: "involvement", translation: "участие, причастность", context: "Somebody reported your involvement to HR.", time: "46:30", level: "B2" },
  { word: "violation", translation: "нарушение", context: "In direct violation of our company's code of conduct.", time: "46:44", level: "B2" },
  { word: "code of conduct", translation: "корпоративный кодекс", context: "Our company's code of conduct.", time: "46:44", level: "C1" },
  { word: "protection", translation: "защита", context: "We take our protections very seriously.", time: "46:49", level: "B2" },
  { word: "org chart", translation: "организационная структура", context: "He's nowhere on my org chart.", time: "46:52", level: "C1" },
  { word: "labor lawyer", translation: "юрист по трудовому праву", context: "A conference room full of labor lawyers.", time: "47:01", level: "B2" },
  { word: "interconnected", translation: "взаимосвязанный", context: "A series of interconnected decisions.", time: "49:52", level: "C1" },
  { word: "perspective", translation: "точка зрения", context: "Viewed from a certain perspective.", time: "49:51", level: "B2" },

  // SEGMENT 6
  { word: "patrol", translation: "патруль", context: "Westmont Village has its own private security patrol.", time: "50:08", level: "B2" },
  { word: "crime rate", translation: "уровень преступности", context: "The crime rate is almost nonexistent.", time: "50:14", level: "B2" },
  { word: "nonexistent", translation: "несуществующий", context: "The crime rate is almost nonexistent.", time: "50:14", level: "C1" },
  { word: "insulated", translation: "отгороженный", context: "Insulated from the rest of the world.", time: "50:20", level: "B2" },
  { word: "complacent", translation: "благодушный, потерявший бдительность", context: "You get complacent about things like alarm systems.", time: "50:23", level: "B2" },
  { word: "alarm system", translation: "сигнализация", context: "Alarm systems.", time: "50:23", level: "B1" },
  { word: "sealed", translation: "герметичный", context: "Sealed 18-karat white gold.", time: "51:16", level: "B2" },
  { word: "karat", translation: "карат", context: "18-karat white gold.", time: "51:16", level: "B2" },
  { word: "sunburst", translation: "лучистый (циферблат)", context: "Blue sunburst dial.", time: "51:18", level: "C2" },
  { word: "dial", translation: "циферблат", context: "Blue sunburst dial.", time: "51:18", level: "B2" },
  { word: "water-resistant", translation: "водозащищённый", context: "Water-resistant up to 30 meters.", time: "51:19", level: "B2" },
  { word: "merely", translation: "просто, лишь", context: "You merely look after it.", time: "51:27", level: "B2" },
  { word: "vacation watch", translation: "наблюдение в отъезде", context: "Your house was placed on a vacation watch.", time: "52:23", level: "C1" },
  { word: "appreciate", translation: "ценить, благодарен", context: "I appreciate it.", time: "52:42", level: "B1" },
  { word: "deserve", translation: "заслуживать", context: "They didn't deserve all of this.", time: "53:13", level: "B1" },
  { word: "wealth", translation: "богатство", context: "Piles of forgotten wealth.", time: "53:25", level: "B1" },
  { word: "drawer", translation: "ящик стола", context: "Lying around in drawers.", time: "53:25", level: "B1" },
  { word: "alimony", translation: "алименты", context: "I was thinking about alimony, child support, legal fees.", time: "53:47", level: "B2" },
  { word: "legal fees", translation: "судебные издержки", context: "Alimony, child support, legal fees.", time: "53:47", level: "B2" },
  { word: "home equity line", translation: "кредитная линия под залог дома", context: "A maxed out home equity line.", time: "53:50", level: "C1" },
  { word: "tuition", translation: "плата за обучение", context: "Tuition, property taxes.", time: "53:50", level: "B2" },
  { word: "property taxes", translation: "налог на недвижимость", context: "Tuition, property taxes.", time: "53:50", level: "B2" },
  { word: "premium", translation: "страховой взнос", context: "Health insurance premiums.", time: "53:53", level: "B2" },
  { word: "exterminator", translation: "дезинсектор", context: "Gardeners, exterminators, roofers.", time: "53:57", level: "B2" },
  { word: "roofer", translation: "кровельщик", context: "Exterminators, roofers, painters.", time: "53:57", level: "B2" },
  { word: "plumber", translation: "сантехник", context: "Roofers, painters, plumbers.", time: "53:57", level: "B2" },
  { word: "in the red", translation: "в минусе", context: "A bank account that was still in the red.", time: "53:59", level: "C1" },
  { word: "suspect", translation: "подозревать", context: "No one would ever suspect a guy like me.", time: "54:05", level: "B1" },
  { word: "temporary", translation: "временный", context: "It was just temporary.", time: "54:10", level: "B1" }
];

// Add segment + sort
phrasalVerbs.forEach(p => p.segment = tsToSegment(p.time));
idioms.forEach(i => i.segment = tsToSegment(i.time));
vocabulary.forEach(v => v.segment = tsToSegment(v.time));

const sortByTime = (a, b) => tsToSeconds(a.time) - tsToSeconds(b.time);
phrasalVerbs.sort(sortByTime);
idioms.sort(sortByTime);
vocabulary.sort(sortByTime);

// Build segments
const segmentMeta = [
  { number: 1, timeRange: "00:00-10:00", description: "Знакомство в баре с Лив; \"This is what happens\"" },
  { number: 2, timeRange: "10:00-20:00", description: "Увольнение; разговор с Хантером и бывшей женой" },
  { number: 3, timeRange: "20:00-30:00", description: "Сэм и Куп; попытка вернуться в Bailey; ужин с Барни" },
  { number: 4, timeRange: "30:00-40:00", description: "Вечеринка у Миллеров; Брюс и Эли" },
  { number: 5, timeRange: "40:00-50:00", description: "Разговор с Лив; столкновение с Джеком; разговор с Мел" },
  { number: 6, timeRange: "50:00-55:00", description: "Кражи в Westmont Village; финал серии" }
];

const segments = segmentMeta.map(meta => {
  const pv = phrasalVerbs.filter(x => x.segment === meta.number);
  const id = idioms.filter(x => x.segment === meta.number);
  const vc = vocabulary.filter(x => x.segment === meta.number);
  return {
    number: meta.number,
    timeRange: meta.timeRange,
    description: meta.description,
    counts: {
      phrasalVerbs: pv.length,
      idioms: id.length,
      vocabulary: vc.length,
      total: pv.length + id.length + vc.length
    },
    phrasalVerbs: pv,
    idioms: id,
    vocabulary: vc
  };
});

// Stats by level
const levelCounts = { B1: 0, B2: 0, C1: 0, C2: 0 };
vocabulary.forEach(v => { if (levelCounts[v.level] !== undefined) levelCounts[v.level]++; });

// Final JSON structure
const output = {
  show: "Your Friends & Neighbors",
  season: 1,
  episode: 1,
  episodeTitle: "This Is What Happens",
  language: {
    source: "en",
    target: "ru"
  },
  meta: {
    generatedFromSubtitles: "Your_Friends_Neighbors_-_1x01_-_This_Is_What_Happens_WEB_ATVP_en.srt",
    totalDurationApprox: "55:00",
    segmentDuration: "10:00",
    totalSegments: 6
  },
  totals: {
    phrasalVerbs: phrasalVerbs.length,
    idioms: idioms.length,
    vocabulary: vocabulary.length,
    grandTotal: phrasalVerbs.length + idioms.length + vocabulary.length,
    vocabularyByLevel: levelCounts
  },
  fieldDescriptions: {
    phrase: "The phrasal verb / idiom in English",
    word: "The vocabulary word in English",
    translation: "Russian translation",
    context: "Direct quote from the episode (English)",
    contextTranslation: "Russian translation of the context",
    literalTranslation: "Literal/word-for-word breakdown of the expression",
    history: "Origin and historical background of the expression",
    time: "Timestamp in the episode (MM:SS)",
    segment: "Which 10-minute segment (1-6)",
    level: "CEFR level for vocabulary (B1, B2, C1, C2)"
  },
  segments: segments,
  // Flat lists for convenience
  allPhrasalVerbs: phrasalVerbs,
  allIdioms: idioms,
  allVocabulary: vocabulary
};

fs.writeFileSync('/home/claude/YFN_S01E01.json', JSON.stringify(output, null, 2));

console.log("JSON created!");
console.log(`Total entries: ${output.totals.grandTotal}`);
console.log(`Phrasal verbs: ${phrasalVerbs.length}`);
console.log(`Idioms: ${idioms.length}`);
console.log(`Vocabulary: ${vocabulary.length} (B1: ${levelCounts.B1}, B2: ${levelCounts.B2}, C1: ${levelCounts.C1}, C2: ${levelCounts.C2})`);
const stats = fs.statSync('/home/claude/YFN_S01E01.json');
console.log(`File size: ${(stats.size/1024).toFixed(1)} KB`);
