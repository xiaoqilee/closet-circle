import requests
import json
from jsonschema import validate, ValidationError
import html
from typing import Any, Dict, Text, List
from rasa.engine.graph import GraphComponent, ExecutionContext
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.shared.nlu.training_data.message import Message
from rasa.engine.recipes.default_recipe import DefaultV1Recipe

@DefaultV1Recipe.register("components.OllamaNLU", is_trainable=False)
class OllamaNLU(GraphComponent):
    """ RASA NLU component that uses Ollama API for intent classification and entity extraction. """

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> "OllamaNLU":
        return cls(config)

    def __init__(self, config: Dict[Text, Any]):
        self.config = config
        self.valid_intents = ["find_item", "greet", "goodbye", "affirm", "deny", "book_item", "provide_item_type", "provide_color", "bot_challenge"]
        self.valid_entities = ["color", "item_type", "item_name"]

    def process(self, messages: List[Message]) -> List[Message]:
        for message in messages:
            user_text = html.escape(message.text.strip())

            prompt = f"""
            You are a helpful booking assistant for Closet Circle, a fun and sustainable alternative to fast fashion, where users can borrow clothes instead of buying them. 
            Your task is to ONLY extract the intents and entities from the user's message. 
            
            INTENTS (choose one):
            - find_item: user wants to search/find/look for clothing
            - greet: user says hello/hi
            - goodbye: user says bye/goodbye
            - affirm: user says yes/ok/sure
            - deny: user says no/nope
            - book_item: user wants to book/reserve an item
            
            ENTITIES to extract: item_name, item_type, color
            
            IMPORTANT - Map color to these NUMERIC category IDs: 
            - "black" -> "10"
            - "white" -> "11"
            - "red" -> "12"
            - "blue" -> "13"
            - "green" -> "14"
            - "pink" -> "15"
            
            YOU MUST extract color as a NUMBER string based on the above mapping. 
            
            For example, if the user says "I want a red dress", extract color with value "12" (NOT "red").
            If a user provides a color not in this list, map to the value of the closest matching color in the list. 
            ALWAYS add the NUMBER to the list, NEVER the color name.
            
            Store all colors mentioned in a list. For example:
            - "black shoes" -> color entity value should be ["10"]
            - "blue or green dress" -> color entity value should be ["13", "14"]
            - No colors mentioned -> color entity value should be []
                        
            IMPORTANT - Normalize item_type to ONLY these values:
            - "dress" (includes: gown, frock, sundress)
            - "shirt" (includes: top, tee, t-shirt, tshirt, blouse, button-up)
            - "pants" (includes: trousers, slacks, chinos, leggings)
            - "jacket" (includes: blazer, coat, cardigan, sweater, hoodie, outerwear)
            - "skirt" (includes: miniskirt, maxi skirt)
            - "jeans" (includes: denim, denim pants)
            - "shorts" (includes: short pants)
            - "shoes" (includes: sneakers, boots, heels, sandals, footwear)
            
            If the user provides an item_type not in this list, do NOT extract it as an entity. 
            If the user provides a singular item type (e.g., dress), map plural forms (e.g., dresses) to the singular normalized value.
    
            Always return the normalized value, not the user's exact word.
            
            
            Respond ONLY in JSON:
            {{
                "intent": "<intent_name>",
                "entities": [
                    {{"entity": "color", "value": ["10", "13"], "start": <start>, "end": <end>}},
                    {{"entity": "item_type", "value": "<normalized_value>", "start": <start>, "end": <end>}},
                    {{"entity": "item_name", "value": "<brand_or_product_name>", "start": <start>, "end": <end>}}
                ]
            }}
            
            NOTE: For color, value MUST be a list of number strings like ["10"] or ["13", "14"], NOT color names!
            
            User message: "{user_text}"
            """

            # calling Ollama API
            try: 
                print(f"[OllamaNLU] Processing message: {user_text}")
                r = requests.post(
                    "http://localhost:11434/api/generate",
                        json={"model": "llama3", "prompt": prompt, "stream": False}
                    ).json()
                llm_output = r.get("response", "{}")
                print(f"[OllamaNLU] Raw response: {llm_output[:200] if llm_output else 'empty'}")
                if isinstance(llm_output, str):
                    llm_output = json.loads(llm_output)
                print(f"[OllamaNLU] Parsed output: {llm_output}")

                # schema validation
                # - color: array of strings (numbers like "10" or names like "red" - converted in actions)
                # - item_type, item_name: strings
                schema = {
                    "type": "object",
                    "properties": {
                        "intent": {"type": "string"},
                        "entities": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "entity": {"type": "string"},
                                    "value": {
                                        "oneOf": [
                                            {"type": "string"},
                                            {"type": "array", "items": {"type": "string"}}
                                        ]
                                    },
                                    "start": {"type": "number"},
                                    "end": {"type": "number"},
                                },
                                "required": ["entity", "value", "start", "end"],
                            },
                        },
                    },
                    "required": ["intent", "entities"],
                }
                validate(instance=llm_output, schema=schema)
                intent_name = llm_output.get("intent", "nlu_fallback")

                if intent_name not in self.valid_intents:
                    intent_name = "nlu_fallback"
                message.set("intent", {"name": intent_name, "confidence": 0.9})

                entities = llm_output.get("entities", [])
                validated_entities = []

                for e in entities:
                    if e.get("entity") in self.valid_entities:
                        e["start"] = int(e.get("start", 0))
                        e["end"] = int(e.get("end", len(e.get("value",""))))
                        validated_entities.append(e)

                message.set("entities", validated_entities)

            except (json.JSONDecodeError, ValidationError, requests.RequestException) as e:
                # fallback message is sent if error
                message.set("intent", {"name": "nlu_fallback", "confidence": 0.0})
                message.set("entities", [])
                print(f"OllamaNLU error: {e}")

        return messages
