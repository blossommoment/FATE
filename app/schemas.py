from enum import StrEnum

from pydantic import BaseModel, Field


class Element(StrEnum):
    wood = "木"
    fire = "火"
    earth = "土"
    metal = "金"
    water = "水"


class FeedbackSignal(StrEnum):
    like = "like"
    skip = "skip"
    chat = "chat"
    voice = "voice"
    meet = "meet"


class BaziTag(BaseModel):
    name: str
    meaning: str
    intensity: int = Field(ge=0, le=100)


class RichTagProfile(BaseModel):
    id: str
    source_tag: str
    display_name: str
    summary: str
    personality_tags: list[str]
    social_tags: list[str]
    career_tags: list[str]
    emotion_tags: list[str]
    match_preferences: list[str]
    suitable_scenes: list[str]
    risk_notes: list[str]
    match_weights: dict[str, int]


class FateChart(BaseModel):
    birth_info: str
    day_master: Element
    pattern: str
    pillars: list[str]
    tags: list[BaziTag]


class FeatureCard(BaseModel):
    title: str
    subtitle: str
    glow: str
    score: int = Field(ge=0, le=100)


class LoopStage(BaseModel):
    name: str
    status: str
    confidence: int = Field(ge=0, le=100)


class HomeResponse(BaseModel):
    user_id: str
    fate_chart: FateChart
    feature_cards: list[FeatureCard]
    loop: list[LoopStage]


class TrendItem(BaseModel):
    label: str
    share: int = Field(ge=0, le=100)
    momentum: str


class Post(BaseModel):
    id: str
    author: str
    insight: str
    tags: list[str]
    trend_evaluation: str
    reactions: int


class SquareResponse(BaseModel):
    title: str
    trends: list[TrendItem]
    posts: list[Post]


class PlaceRecommendation(BaseModel):
    id: str
    name: str
    category: str
    element_affinity: Element
    match_score: int = Field(ge=0, le=100)
    reason: str
    trend_evaluation: str


class CoordinatesResponse(BaseModel):
    user_id: str
    title: str
    map_energy_points: list[dict[str, str | int]]
    places: list[PlaceRecommendation]


class ChatPreview(BaseModel):
    id: str
    user_name: str
    avatar_ring: str
    bazi_tags: list[str]
    compatibility: int = Field(ge=0, le=100)
    last_message: str
    has_voice: bool = False
    voice_duration_seconds: int | None = None
    unread_count: int = 0


class ProfileResponse(BaseModel):
    user_id: str
    name: str
    level: str
    fate_id: str
    chart: FateChart
    energy_index: dict[Element, int]
    sections: list[str]
    posts: list[Post]


class FeedbackCreate(BaseModel):
    user_id: str
    target_id: str
    signal: FeedbackSignal
    context: str = Field(description="chat, location, match, post, or voice")
    weight: int = Field(default=1, ge=1, le=5)


class FeedbackResult(BaseModel):
    user_id: str
    target_id: str
    signal: FeedbackSignal
    updated_score: int
    learning_note: str
