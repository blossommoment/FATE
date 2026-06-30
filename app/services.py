from app.data import POSTS, RECOMMENDATION_WEIGHTS, USERS
from app.schemas import (
    ChatPreview,
    CoordinatesResponse,
    FeatureCard,
    FeedbackCreate,
    FeedbackResult,
    HomeResponse,
    LoopStage,
    PlaceRecommendation,
    SquareResponse,
    TrendItem,
    Element,
    ProfileResponse,
)
from app.tag_library import TAG_LIBRARY


class FateService:
    def home(self, user_id: str) -> HomeResponse:
        user = self._user(user_id)
        return HomeResponse(
            user_id=user_id,
            fate_chart=user["chart"],
            feature_cards=[
                FeatureCard(title="世另我", subtitle="寻找和我同八字的人", glow="gold", score=89),
                FeatureCard(title="语音匹配", subtitle="基于大数据智能推荐", glow="purple", score=96),
                FeatureCard(title="今日推荐", subtitle="基于大数据个性化推荐", glow="orange", score=92),
            ],
            loop=[
                LoopStage(name="Bazi classification", status="八字人格分型完成", confidence=94),
                LoopStage(name="Smart recommendation", status="生成今日匹配池", confidence=91),
                LoopStage(name="Chat feedback", status="等待互动信号", confidence=76),
                LoopStage(name="Data iteration", status="实时校准推荐权重", confidence=88),
            ],
        )

    def square(self) -> SquareResponse:
        return SquareResponse(
            title="分析广场",
            trends=[
                TrendItem(label="木旺", share=31, momentum="+12%"),
                TrendItem(label="伤官格", share=24, momentum="+18%"),
                TrendItem(label="金水相生", share=21, momentum="+9%"),
                TrendItem(label="火土燥", share=14, momentum="+6%"),
            ],
            posts=POSTS,
        )

    def coordinates(self, user_id: str) -> CoordinatesResponse:
        self._user(user_id)
        weights = RECOMMENDATION_WEIGHTS.setdefault(user_id, {})
        return CoordinatesResponse(
            user_id=user_id,
            title="命运坐标",
            map_energy_points=[
                {"id": "e_wood_01", "element": "木", "x": 28, "y": 42, "glow": "emerald"},
                {"id": "e_fire_01", "element": "火", "x": 62, "y": 31, "glow": "orange"},
                {"id": "e_water_01", "element": "水", "x": 47, "y": 68, "glow": "violet"},
            ],
            places=[
                PlaceRecommendation(
                    id="place_moonwood",
                    name="月木咖啡",
                    category="cafe",
                    element_affinity=Element.wood,
                    match_score=weights.get("place_moonwood", 92),
                    reason="木火表达型用户在低噪声咖啡场景更容易进入深聊。",
                    trend_evaluation="近 7 日复聊率 93%",
                ),
                PlaceRecommendation(
                    id="place_goldwater",
                    name="金水餐厅",
                    category="restaurant",
                    element_affinity=Element.water,
                    match_score=weights.get("place_goldwater", 88),
                    reason="金水场域能平衡火旺表达，适合第一次线下见面。",
                    trend_evaluation="同类用户收藏 +21%",
                ),
                PlaceRecommendation(
                    id="place_lihuo",
                    name="离火酒廊",
                    category="bar",
                    element_affinity=Element.fire,
                    match_score=weights.get("place_lihuo", 84),
                    reason="适合高能社交，但建议匹配金水型对象降低上头概率。",
                    trend_evaluation="语音后到店转化 +16%",
                ),
            ],
        )

    def messages(self, user_id: str) -> list[ChatPreview]:
        self._user(user_id)
        return [
            ChatPreview(
                id="u_2002",
                user_name="沈予白",
                avatar_ring="金水相生",
                bazi_tags=["金水相生", "冷静倾听"],
                compatibility=RECOMMENDATION_WEIGHTS[user_id]["u_2002"],
                last_message="刚才那段语音我听懂了，你不是想赢，是想被理解。",
                has_voice=True,
                voice_duration_seconds=12,
                unread_count=2,
            ),
            ChatPreview(
                id="u_3003",
                user_name="江燃",
                avatar_ring="火土燥",
                bazi_tags=["火土燥", "行动派"],
                compatibility=82,
                last_message="今晚去离火酒廊？系统说我们适合短时高能场。",
            ),
        ]

    def profile(self, user_id: str) -> ProfileResponse:
        user = self._user(user_id)
        return ProfileResponse(
            user_id=user_id,
            name=user["name"],
            level=user["level"],
            fate_id=user["fate_id"],
            chart=user["chart"],
            energy_index=user["energy_index"],
            sections=["我的八字命盘", "我的性格标签", "命运契合度", "我的帖子"],
            posts=POSTS[:2],
        )

    def tags(self):
        return TAG_LIBRARY

    def record_feedback(self, payload: FeedbackCreate) -> FeedbackResult:
        self._user(payload.user_id)
        weights = RECOMMENDATION_WEIGHTS.setdefault(payload.user_id, {})
        current = weights.get(payload.target_id, 75)
        delta = {
            "like": 2,
            "chat": 3,
            "voice": 4,
            "meet": 5,
            "skip": -3,
        }[payload.signal.value] * payload.weight
        updated = max(1, min(99, current + delta))
        weights[payload.target_id] = updated
        return FeedbackResult(
            user_id=payload.user_id,
            target_id=payload.target_id,
            signal=payload.signal,
            updated_score=updated,
            learning_note=f"已根据 {payload.context} 反馈更新推荐权重，下一轮推荐会提高相似场景的排序。",
        )

    def _user(self, user_id: str) -> dict:
        if user_id not in USERS:
            raise KeyError(f"user not found: {user_id}")
        return USERS[user_id]


fate_service = FateService()
