from app.schemas import BaziTag, Element, FateChart, Post


USERS = {
    "u_1001": {
        "name": "林七月",
        "level": "Lv.7 星盘共鸣者",
        "fate_id": "FATE-0721-MH",
        "chart": FateChart(
            birth_info="2001.07.21 09:36 杭州",
            day_master=Element.wood,
            pattern="木火通明",
            pillars=["辛巳", "乙未", "甲午", "己巳"],
            tags=[
                BaziTag(name="木火通明", meaning="能说会道、表达力强", intensity=94),
                BaziTag(name="社交磁场", meaning="容易把陌生关系聊热", intensity=88),
                BaziTag(name="灵感快闪", meaning="创意反应快但需要被接住", intensity=82),
            ],
        ),
        "energy_index": {
            Element.wood: 32,
            Element.fire: 28,
            Element.earth: 16,
            Element.metal: 9,
            Element.water: 15,
        },
    },
    "u_2002": {
        "name": "沈予白",
        "level": "Lv.5 金水观察者",
        "fate_id": "FATE-1210-JS",
        "chart": FateChart(
            birth_info="1999.12.10 22:18 上海",
            day_master=Element.water,
            pattern="金水相生",
            pillars=["己卯", "丙子", "壬申", "辛亥"],
            tags=[
                BaziTag(name="金水相生", meaning="理性敏锐、共情稳定", intensity=91),
                BaziTag(name="冷静倾听", meaning="适合深夜长聊", intensity=86),
            ],
        ),
        "energy_index": {
            Element.wood: 12,
            Element.fire: 10,
            Element.earth: 13,
            Element.metal: 30,
            Element.water: 35,
        },
    },
}


POSTS = [
    Post(
        id="p_001",
        author="闻星",
        insight="和同为伤官格的人聊天，节奏会特别快，但真正留下来的反而是能接住沉默的人。",
        tags=["伤官格", "表达欲", "深聊"],
        trend_evaluation="伤官格用户近期语音匹配留存 +18%",
        reactions=428,
    ),
    Post(
        id="p_002",
        author="蓝澈",
        insight="木旺的人不是永远外向，是需要一个不会压住生长感的关系场。",
        tags=["木旺", "关系边界", "咖啡约见"],
        trend_evaluation="木旺 x 金水相生组合好评率 91%",
        reactions=312,
    ),
    Post(
        id="p_003",
        author="橙火",
        insight="火土燥的人在高刺激场景里容易上头，慢节奏地点反而更容易稳定互动。",
        tags=["火土燥", "地点推荐", "情绪反馈"],
        trend_evaluation="火土燥用户公园类地点复聊率 +23%",
        reactions=267,
    ),
]


RECOMMENDATION_WEIGHTS = {
    "u_1001": {
        "u_2002": 96,
        "place_moonwood": 92,
        "place_goldwater": 88,
        "place_lihuo": 84,
    }
}
