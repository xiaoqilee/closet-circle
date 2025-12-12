# This files contains your custom actions which can be used to run
# custom Python code.
#
# See this guide on how to implement these action:
# https://rasa.com/docs/rasa/custom-actions


from typing import Any, Text, Dict, List
import json
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
import requests
from thefuzz import fuzz

class ActionFindItem(Action):
    def name(self) -> Text:
        return "action_find_item"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        # Get entities from the CURRENT message only (not old slot values)
        # This ensures we start fresh with each new search request
        latest_entities = tracker.latest_message.get("entities", [])
        entity_values = {e["entity"]: e["value"] for e in latest_entities}
        
        # Use values from current message entities only for a fresh search
        item_type = entity_values.get("item_type")
        color_list = entity_values.get("color")
        item_name = entity_values.get("item_name")
        
        print(f"DEBUG: Fresh search - entities from message: {entity_values}")
        
        # Normalize color_list: ensure it's a list or None
        if color_list is None or (isinstance(color_list, list) and len(color_list) == 0):
            color_list = None
        elif not isinstance(color_list, list):
            # If single color value, wrap in list
            color_list = [color_list]

        # If no search criteria provided, ask for more info
        if not item_type and not color_list and not item_name:
            dispatcher.utter_message(text="What are you looking for? You can tell me a type (like dress, shoes, jacket), a color, or a brand name!")
            return []

        try:
            # Query your backend API - gets posts with images and lister info
            response = requests.get("http://localhost:8800/api/posts-all", timeout=5)
            data = response.json()
            posts = data.get("posts", [])
            
            # Debug: print what we got
            print(f"DEBUG: item_type={item_type}, color_list={color_list}, item_name={item_name}, total posts={len(posts)}")
            
            # If no posts at all, show message
            if not posts:
                dispatcher.utter_message(text="Sorry, there are no items in the database yet. Check back later!")
                return []
            
            # Filter posts based on item_type and color
            items = []
            
            # Define related terms for item types (for better matching)
            item_type_synonyms = {
                "shoes": ["shoes", "sneakers", "boots", "heels", "sandals", "loafers", "cleats", "footwear", "pumps"],
                "shirt": ["shirt", "top", "tee", "t-shirt", "blouse", "button up"],
                "pants": ["pants", "trousers", "slacks", "chinos", "leggings", "jeans"],
                "jacket": ["jacket", "blazer", "coat", "cardigan", "sweater", "hoodie", "puffer"],
                "dress": ["dress", "gown", "frock", "sundress"],
                "skirt": ["skirt", "miniskirt"],
                "shorts": ["shorts"],
                "jeans": ["jeans", "denim"],
            }
            
            # Map color names to category IDs from database
            color_category_ids = {
                "black": 10,
                "white": 11,
                "red": 12,
                "blue": 13,
                "green": 14,
                "pink": 15,
            }
            
            # preprocessing colors to category IDs
         
            if color_list:
                mapped_colors = []
                for c in color_list:
                    if c in color_category_ids:
                        mapped_colors.append(str(color_category_ids[c]))
                color_list = mapped_colors if mapped_colors else None
            print(f"DEBUG: Mapped color_list to category IDs: {color_list}")
            
            # Get all synonyms for the item_type
            search_terms = [item_type.lower()] if item_type else []
            if item_type:
                for key, synonyms in item_type_synonyms.items():
                    if item_type.lower() in synonyms or item_type.lower() == key:
                        search_terms = synonyms
                        break
            
            for post in posts:
                title = post.get("title", "").lower()
                description = post.get("description", "").lower()
                post_categories = post.get("categories", [])
                
                # Check if any item_type synonym matches title
                type_match = not item_type or any(term in title for term in search_terms)
                
                # Check if color matches using CATEGORY IDs (same as website filtering)
                color_category_ids_list = list(color_category_ids.values())  # [10, 11, 12, 13, 14, 15]
                item_has_color_category = any(cat_id in post_categories for cat_id in color_category_ids_list)
                
                # Default to True (match all) if no color filter
                color_match = True
                if color_list:
                    color_match = False  # Must match at least one color
                    for c in color_list:
                        try:
                            color_id = int(c)
                            if color_id in post_categories:
                                color_match = True
                                print(f"DEBUG: Color match! Post '{title}' has category {color_id}")
                                break
                        except (ValueError, TypeError):
                            pass
                    
                    # DEBUG: Log why items don't match
                    if not color_match:
                        print(f"DEBUG: No color match for '{title}' - post_categories={post_categories}, looking for {color_list}")
                
                # Check if item_name matches (fuzzy or substring based)
                # Use lower threshold for fuzzy matching, or simple substring match
                if item_name:
                    item_name_lower = item_name.lower()
                    # First try direct substring match
                    direct_match = item_name_lower in title or item_name_lower in description
                    # Then try fuzzy match with lower threshold
                    fuzzy_score_title = fuzz.partial_ratio(item_name_lower, title)
                    fuzzy_score_desc = fuzz.partial_ratio(item_name_lower, description)
                    name_match = direct_match or fuzzy_score_title > 60 or fuzzy_score_desc > 60
                    print(f"DEBUG: Checking '{item_name}' against '{title}' - direct={direct_match}, fuzzy_title={fuzzy_score_title}, fuzzy_desc={fuzzy_score_desc}")
                else:
                    name_match = True
                
                if type_match and color_match and name_match:
                    items.append(post)
            
            print(f"DEBUG: Found {len(items)} matching items")
            
            if items:
                first_item = items[0]
                image_url = first_item.get('images', [None])[0]
                dispatcher.utter_message(
                    text=f"Found: {first_item.get('title', 'Unknown')} - {first_item.get('description', 'No description')} (${first_item.get('price', 'N/A')}). Would you like to book this item?",
                    image=image_url
                )
                # Store the filtered items as JSON string and current index
                import json
                return [
                    SlotSet("selected_post_id", first_item.get("post_id")),
                    SlotSet("filtered_items", json.dumps([p.get("post_id") for p in items])),
                    SlotSet("current_item_index", 0),
                    # Set search slots to current values (clearing old ones)
                    SlotSet("item_type", item_type),
                    SlotSet("color", color_list),
                    SlotSet("item_name", item_name)
                ]
            else:
                # Show what's available instead
                sample_titles = [p.get("title", "Unknown") for p in posts[:3]]
                color_str = ", ".join(str(c) for c in color_list) if color_list else ""
                dispatcher.utter_message(text=f"Sorry, I couldn't find any{item_type or 'items'} in that color. We have items like: {', '.join(sample_titles)}. Try searching for something else!")
                # Clear all search slots for fresh start
                return [
                    SlotSet("item_type", None),
                    SlotSet("color", None),
                    SlotSet("item_name", None)
                ]
        
        except requests.exceptions.RequestException as e:
            dispatcher.utter_message(text="Sorry, I'm having trouble connecting to the server. Please try again later.")

        return []


class ActionShowNextItem(Action):
    def name(self) -> Text:
        return "action_show_next_item"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        
        filtered_items_json = tracker.get_slot("filtered_items")
        current_index = tracker.get_slot("current_item_index") or 0
        
        if not filtered_items_json:
            dispatcher.utter_message(text="No more items to show. Try a new search!")
            return []
        
        try:
            item_ids = json.loads(filtered_items_json)
        except:
            dispatcher.utter_message(text="No more items to show. Try a new search!")
            return []
        
        next_index = current_index + 1
        
        if next_index >= len(item_ids):
            dispatcher.utter_message(text="That's all the items I found! Would you like to search for something else?")
            # Clear ALL search-related slots so next search starts fresh
            return [
                SlotSet("selected_post_id", None),
                SlotSet("filtered_items", None),
                SlotSet("current_item_index", None),
                SlotSet("item_type", None),
                SlotSet("item_name", None),
                SlotSet("color", None)
            ]
        
        # Fetch the next item details
        try:
            response = requests.get("http://localhost:8800/api/posts-all", timeout=5)
            data = response.json()
            posts = data.get("posts", [])
            
            next_post_id = item_ids[next_index]
            next_item = None
            for post in posts:
                if post.get("post_id") == next_post_id:
                    next_item = post
                    break
            
            if next_item:
                image_url = next_item.get('images', [None])[0]
                dispatcher.utter_message(
                    text=f"How about this one: {next_item.get('title', 'Unknown')} - {next_item.get('description', 'No description')} (${next_item.get('price', 'N/A')}). Would you like to book this item?",
                    image=image_url
                )
                return [
                    SlotSet("selected_post_id", next_post_id),
                    SlotSet("current_item_index", next_index)
                ]
            else:
                dispatcher.utter_message(text="Sorry, I couldn't find that item. Try a new search!")
                return []
                
        except requests.exceptions.RequestException as e:
            dispatcher.utter_message(text="Sorry, I'm having trouble connecting to the server.")
            return []


class ActionBookItem(Action):
    def name(self) -> Text:
        return "action_book_item"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        sender_id = tracker.sender_id
        metadata = tracker.latest_message.get("metadata", {})
        user_email = metadata.get("user_email")
        # Get the selected post_id from slots
        post_id = tracker.get_slot("selected_post_id")

        if not post_id:
            dispatcher.utter_message(text="Sorry, I don't have an item selected to book. Please search for an item first.")
            return []

        if not user_email:
            user_email = tracker.get_slot("email")

        if not user_email:
            dispatcher.utter_message(text="I don't know your account email. Please log in on the website or tell me your email so I can add the item to your cart.")
            return []

        try:
            tx_resp = requests.get("http://localhost:8800/api/profile/cart/id", params={"email": user_email}, timeout=5)
            tx_resp.raise_for_status()
            tx_data = tx_resp.json()
            transaction_id = tx_data.get("transactionId")

            # if none, create a new pending transaction using server endpoint
            if not transaction_id:
                create_resp = requests.post("http://localhost:8800/api/profile/cart/create", json={"email": user_email}, timeout=5)
                create_resp.raise_for_status()
                transaction_id = create_resp.json().get("transactionId")

            if not transaction_id:
                dispatcher.utter_message(text=(
                    "I couldn't create or find an active cart for your account. "
                    "Please try again from the website if the problem continues."
                ))
                return []

            # add item to cart (use correct API prefix and PUT method)
            add_url = "http://localhost:8800/api/profile/cart/addItem"
            
          
            add_payload = {"transactionId": transaction_id, "postId": post_id}
            add_resp = requests.put(add_url, json=add_payload, timeout=5)
            add_resp.raise_for_status()
            
            
            dispatcher.utter_message(text=f"Great! I've added this item to your cart (transaction {transaction_id}). You can view your cart on the website to confirm.")
            
            cart_resp = requests.get("http://localhost:8800/api/profile/cart", params={"email": user_email}, timeout=5)
            cart_data = cart_resp.json()
            cart_items = cart_data.get("cart", [])
            cart_total = sum(item.get("price", 0) for item in cart_items)
            dispatcher.utter_message(text=f"Your cart total is now ${cart_total:.2f}.")
            
            # Clear akl slots after booking for fresh start
            return [
                SlotSet("selected_post_id", None),
                SlotSet("filtered_items", None),
                SlotSet("current_item_index", None),
                SlotSet("item_type", None),
                SlotSet("color", None),
                SlotSet("item_name", None)
            ]

        except requests.exceptions.RequestException:
            dispatcher.utter_message(text="Sorry, I'm having trouble connecting to the server. Please try again later.")
            return []
