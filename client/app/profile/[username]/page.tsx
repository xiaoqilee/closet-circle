'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useUser, withPageAuthRequired } from '@auth0/nextjs-auth0/client';
import { useParams }   from 'next/navigation';
import {
    Header,
    Footer,
    ProductCard,
    Product,
} from '../../explore/page';

/* ============================================
   BRAND COLORS
============================================ */
const brandNavy = '#284472';
const brandLightPink = "#fdf5f3";
const brandPink = "#FDEEEA";
const brandLightBrown = "#efe4e1";
const brandBrown = "#675a5e";

// — Filter option arrays (copied from Explore)
const typeOptions      = ['Tops','Bottoms','Outerwear','Dresses','Shoes','Accessories'] as const;
const genderOptions    = ["Men's","Women's","Kids"] as const;
const categoryOptions  = ['For Rent','For Sale'] as const;
const conditionOptions = ['Brand new','Used – Like new','Used – Good','Used – Fair'] as const;
const sizeOptions      = ['XX-Small','X-Small','Small','Medium','Large','X-Large','XX-Large','3X-Large','4X-Large'] as const;
const colorOptions     = ['black','white','red','blue','green','pink'] as const;

export default function ProfilePageByUsername() {
    const { user } = useUser();
    const [followToggle, setToggled] = useState(true); // default button shows 'Follow'

    /* basic profile state */
    const [firstName, setFirstName] = useState('');
    const [lastName,  setLastName ] = useState('');
    //const [email,     setEmail    ] = useState('');
    const [bio,       setBio      ] = useState('');
// ...
    const [items, setClosetItems] = useState<Product[]>([]);
    const [unavailablePostIDs, setUnavailableArr] = useState<Number[]>([]);

    // capture the profile email once learn it from backend
    const [profileEmail, setProfileEmail] = useState<string>('');

// 1) grab the URL segment
const params        = useParams();

    const rawParam   = Array.isArray(params.username) ? params.username[0] : params.username || '';
    const username   = decodeURIComponent(rawParam); // the URL segment is a USERNAME

    const userInfo = {
  first_name:  firstName,
  last_name:   lastName,
  bio,
  profile_url: 'https://static.vecteezy.com/system/resources/previews/009/960/522/non_2x/paper-shopping-bags-free-vector.jpg',
  rating:      4.5,
};


 /* get profile info from db */
useEffect(() => {
  if (!username) return;

  const tryFetch = async () => {
    // helper to safely pick the first user-like object
    const pickUser = (data: any) =>
      data?.user ??
      (Array.isArray(data?.users) && data.users.length > 0 ? data.users[0] : null);

    // try by email (if the segment is actually an email)
    let res: Response | null = null;
    let data: any = null;

    try {
      res = await fetch(
        `http://localhost:8800/api/profile?email=${encodeURIComponent(username)}`,
        { credentials: 'include' }
      );
      data = res.ok ? await res.json() : null;
    } catch {}

    let u = pickUser(data);

    // fall back to username
    if (!u) {
      try {
        res = await fetch(
          `http://localhost:8800/api/profile?username=${encodeURIComponent(username)}`,
          { credentials: 'include' }
        );
        data = res.ok ? await res.json() : null;
      } catch {}
      u = pickUser(data);
    }

    // seed defaults if nothing found
    if (!u) {
      setFirstName(''); setLastName(''); setBio('');
      console.warn('No profile found for', username);
      return;
    }

console.log('GET /api/profile payload:', data);
console.log('Picked user object:', u && { keys: Object.keys(u), u });


setFirstName(u?.first_name ?? u?.firstName ?? u?.given_name ?? '');
setLastName (u?.last_name  ?? u?.lastName  ?? u?.family_name ?? '');
setBio      (u?.bio        ?? u?.about     ?? '');


    // if the backend returned a canonical email, remember itsetFirstName(u?.first_name ?? '')
    if (u.email) setProfileEmail(u.email);
  };

  tryFetch();
}, [username, setProfileEmail]);

/* fetch unavailable items */
useEffect(() => {
  const id = encodeURIComponent(profileEmail || username);
  if (!id) return;

  // If your backend supports username as well, can try both
  fetch(`http://localhost:8800/api/profile/seller-history?email=${id}`, { credentials: 'include' })
    .then((response) => response.json())
    .then((data) => {
      if (!Array.isArray(data?.orders)) return;
      setUnavailableArr(data.orders.map((item: { post_id: number }) => item.post_id));
    })
    .catch((error) => console.log('Error fetching ordered items: ', error));
}, [profileEmail, username]);


/* fetch user’s closet */
useEffect(() => {
  const ownerId = encodeURIComponent(profileEmail || username);
  if (!ownerId) return;

  fetch(`http://localhost:8800/api/profile/posts?ownerID=${ownerId}`, { credentials: 'include' })
    .then((r) => r.json())
    .then((data) => {
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      const transformed: Product[] = posts.map((p: any) => ({
        id        : p.post_id,
        title     : p.title,
        price     : p.price ?? 20,
        forSale   : p.sflag === 1,
        forRent   : p.bflag === 1,
        sold      : unavailablePostIDs.includes(p.post_id),
        images    : p.images,
        type      : getUIType(p.categories),
        audience  : getUIAudience(p.categories),
        colors    : getUIColors(p.categories),
        sizes     : p.size ? [p.size] : [],
        condition : getUICondition(p.item_condition),
        description: p.description,
      }));
      setClosetItems(transformed);
    })
    .catch(console.error);
}, [profileEmail, username, unavailablePostIDs]);


    // map UI labels to db values
    const audienceMap = [
        { label: "Women's", db_val: 1 },
        { label: "Men's", db_val: 2 },
        { label: "Kids", db_val: 3 }
    ];

    const typesMap = [
        { label: "Tops", db_val: 4 },
        { label: "Bottoms", db_val: 5 },
        { label: "Outerwear", db_val: 6 },
        { label: "Dresses", db_val: 7 },
        { label: "Shoes", db_val: 8 },
        { label: "Accessories", db_val: 9 }
    ];

    const colorsMap = [
        { label: colorOptions[0], db_val: 10 },
        { label: colorOptions[1], db_val: 11 },
        { label: colorOptions[2], db_val: 12 },
        { label: colorOptions[3], db_val: 13 },
        { label: colorOptions[4], db_val: 14 },
        { label: colorOptions[5], db_val: 15 }
    ];

    const dbConditionVals = [
        { label: conditionOptions[0], db_val: "new"},
        { label: conditionOptions[1], db_val: "excellent"},
        { label: conditionOptions[2], db_val: "good"},
        { label: conditionOptions[3], db_val: "worn"},
    ];

    // returns one string for type ("Women's", "Men's", or "Kids")
    function getUIAudience(dbVals: any) {
        return audienceMap.filter(item => dbVals.includes(item.db_val)).map(item => item.label);
    }

    // returns one string for type (Tops, Bottoms, Outerwear, ...)
    function getUIType(dbVals: any) {
        return typesMap.filter(item => dbVals.includes(item.db_val)).map(item => item.label);
    }

    // returns array of colors as strings
    function getUIColors(dbVals: any) {
        return colorsMap.filter(item => dbVals.includes(item.db_val)).map(item => item.label);
    }

    // returns one string for condition
    function getUICondition(condition: string) {
        var matchedCondition = dbConditionVals.find(item => item.db_val == condition);
        return matchedCondition?.label;
    }
    
    /* Check if this logged in user is following this profile */
    /* get this profile's followers, check if logged in user is included, set Unfollow if so */
useEffect(() => {
  if (!user) return;
  const whoId = encodeURIComponent(profileEmail || username);
  if (!whoId) return;

  fetch(`http://localhost:8800/api/profile/followers?email=${whoId}`, { credentials: 'include' })
    .then((r) => r.json())
    .then((data) => {
      const followers = Array.isArray(data?.followers) ? data.followers : [];
      const emails = followers.map((f: { email: string }) => f.email);
      setToggled(!emails.includes(user.email)); // false => Unfollow
    })
    .catch(() => setToggled(true));
}, [user, profileEmail, username]);



  /* 
    Follow button saves friends to the database through POST
    If user is already following this profile, removes from friends
  */
  const handleFollow = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    if(!user) return;

    // get data from this logged in user
    const isEmail = (s: string) => /\S+@\S+\.\S+/.test(s);
const friendId = isEmail(profileEmail) ? profileEmail : username; // prefer real email if we have it
const friendInfo = { email: user.email, friend_id: friendId };


    if (followToggle == true) {
        // send data through POST
        const response = await fetch('http://localhost:8800/api/profile/add-friend', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(friendInfo),
        });

        const result = await response.json();

        // redirect to profile page when user submits form
        if (response.ok) {
            console.log('Friend saved:', result);
            // make button show 'Unfollow'
            setToggled(prev => !prev);
        } else {
            console.log('Error:', result);
        }

    } else {
        // remove from followers
        const response = await fetch("http://localhost:8800/api/profile/remove-friend", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(friendInfo),
            });

            const result = await response.json();
            if (response.ok) {
                console.log('Friend saved:', result);
                // make button show 'Follow'
                setToggled(prev => !prev);
            } else {
                console.error("Failed to remove friend:", result.error);
            }
    }
    
  };

    // 4) filter / sort / pagination state
    const [selTypes,    setTypes]    = useState<string[]>([]);
    const [selGender,   setGender]   = useState<string[]>([]);
    const [selCats,     setCats]     = useState<string[]>([]);
    const [selConds,    setConds]    = useState<string[]>([]);
    const [selSizes,    setSizes]    = useState<string[]>([]);
    const [selColors,   setColors]   = useState<string[]>([]);
    const [priceRange,  setPriceRange] = useState<[number,number]>([0,50]);
    const [sort,        setSort]     = useState<'Most Popular'|'Price: Low to High'|'Price: High to Low'>('Most Popular');
    const [page,        setPage]     = useState(1);
    const perPage                     = 9;


    const toggle = (val:string, state:string[], setState:React.Dispatch<React.SetStateAction<string[]>>) => {
        setState(state.includes(val) ? state.filter(x=>x!==val) : [...state,val]);
        setPage(1);
    };

    // 5) apply filters + sort
    const filtered = useMemo(()=> items.filter((p) => {
            if (selTypes.length && (!p.type || !p.type.some((c) => selTypes.includes(c)))) return false;
            if (selGender.length && (!p.audience || !p.audience.some((c) => selGender.includes(c)))) return false;
    
            if(selCats.length){
                const rentMatch = selCats.includes('For Rent') && p.forRent;
                const saleMatch = selCats.includes('For Sale') && p.forSale;
                if(!rentMatch && !saleMatch) return false;
            }
            if (selConds.length && (!p.condition || !selConds.includes(p.condition))) return false;
            if (selSizes.length && (!p.sizes || !p.sizes.some((s) => selSizes.includes(s)))) return false;
            if (selColors.length && (!p.colors || !p.colors.some((c) => selColors.includes(c)))) return false;
            if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
            return true;
        }).sort((a, b) => {
            if (sort === 'Price: Low to High') return a.price - b.price;
            if (sort === 'Price: High to Low') return b.price - a.price;
            return Number(b.id) - Number(a.id);
        }),[selTypes,selGender,selCats,selConds,selSizes,selColors,sort,priceRange,items]);

    // 6) pagination
    const pages     = Math.ceil(filtered.length / perPage);
    const pageItems = filtered.slice((page - 1)*perPage, page*perPage);

    return (
        <div className="profile-page min-h-screen flex flex-col bg-white">
            {/* Hide lister avatar/name pill on ProductCard */}
{/* Hide lister avatar/name pill on ProductCard */}
<style>{`
  .profile-page .absolute.top-2.left-2 {
    display: none !important;
  }
`}</style>

            <Header />

            {/* — User Info */}
            <div className="container mx-auto px-4 mt-16 mb-8">
                <div className="flex items-center justify-center space-x-12">
                {/* avatar + name */}
                    <div className="flex items-center">
                        <img
                            src={userInfo.profile_url}
                            alt="avatar"
                            className="w-24 h-24 rounded-full mr-6 border-4 border-white shadow-lg"
                        />
                        <div>
                            <h2 className="text-3xl font-semibold text-gray-800">
                                {userInfo.first_name} {userInfo.last_name}
                            </h2>
                            <div className="flex items-center text-sm text-gray-600 mt-2">
                                <span className="mr-2">Rating:</span>
                                <div className="flex gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                         strokeWidth="1.5" stroke="currentColor" className="size-6">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563
                                               0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204
                                               3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0
                                               0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982
                                               20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0
                                               0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518
                                               -.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                    </svg>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                         strokeWidth="1.5" stroke="currentColor" className="size-6">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563
                                               0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204
                                               3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0
                                               0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982
                                               20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0
                                               0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518
                                               -.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                    </svg>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                         strokeWidth="1.5" stroke="currentColor" className="size-6">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563
                                               0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204
                                               3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0
                                               0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982
                                               20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0
                                               0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518
                                               -.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                    </svg>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                         strokeWidth="1.5" stroke="currentColor" className="size-6">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563
                                               0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204
                                               3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0
                                               0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982
                                               20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0
                                               0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518
                                               -.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                    </svg>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                         strokeWidth="1.5" stroke="currentColor" className="size-6">
                                        <path strokeLinecap="round" strokeLinejoin="round"
                                              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563
                                               0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204
                                               3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0
                                               0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982
                                               20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0
                                               0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518
                                               -.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                    </svg>
                                    <span className="ml-2">{userInfo.rating.toFixed(1)} / 5</span>
                                </div>
                            </div>


                            <p className="mt-2 text-gray-600">{userInfo.bio}</p>
                        </div>
                    </div>

                    {/* move button in closer by adding ml-6 */}
                    <button
                        style={{ backgroundColor: brandNavy, color: 'white' }}
                        className="ml-6 px-4 py-2 rounded"
                        onClick={handleFollow}
                    >
                        {followToggle ? 'Follow' : 'Unfollow'}
                    </button>
                </div>
            </div>

            {/* — Filters + Listings Grid (layout from Explore) */}
            <div className="container mx-auto py-6 px-4 flex-1 flex gap-6">
                {/* SIDEBAR */}
                <aside className="w-64 space-y-6 text-black">
                    {/* sort */}
                    <div>
                        <h3 className="font-semibold mb-2">Sort by</h3>
                        <select value={sort} onChange={e=>{setSort(e.target.value as any);setPage(1);}}
                                className="w-full border p-2 text-black">
                            <option>Most Popular</option><option>Price: Low to High</option><option>Price: High to Low</option>
                        </select>
                    </div>

                    {/* Audience */}
                    <div>
                        <h3 className="font-semibold mb-2">Audience</h3>
                        {genderOptions.map(g=>(
                            <label key={g} className="flex items-center mb-1">
                                <input type="checkbox" className="mr-2" checked={selGender.includes(g)}
                                       onChange={()=>toggle(g,selGender,setGender)}/> {g}
                            </label>
                        ))}
                    </div>

                    {/* type */}
                    <div>
                        <h3 className="font-semibold mb-2">Type</h3>
                        {typeOptions.map(t=>(
                            <label key={t} className="flex items-center mb-1">
                                <input type="checkbox" className="mr-2" checked={selTypes.includes(t)}
                                       onChange={()=>toggle(t,selTypes,setTypes)}/> {t}
                            </label>
                        ))}
                    </div>

                    {/* category */}
                    <div>
                        <h3 className="font-semibold mb-2">Category</h3>
                        {categoryOptions.map(c=>(
                            <label key={c} className="flex items-center mb-1">
                                <input type="checkbox" className="mr-2" checked={selCats.includes(c)}
                                       onChange={()=>toggle(c,selCats,setCats)}/> {c}
                            </label>
                        ))}
                    </div>

                    {/* price */}
                    <div>
                        <h3 className="font-semibold mb-2">Price ($)</h3>
                        <div className="flex gap-2 items-center">
                            <input type="number" value={priceRange[0]} onChange={e=>setPriceRange([+e.target.value,priceRange[1]])} className="border px-2 w-20"/>
                            <span>-</span>
                            <input type="number" value={priceRange[1]} onChange={e=>setPriceRange([priceRange[0],+e.target.value])} className="border px-2 w-20"/>
                        </div>
                    </div>

                    {/* colours */}
                    <div>
                        <h3 className="font-semibold mb-2">Colors</h3>
                        <div className="flex flex-wrap gap-2">
                            {colorOptions.map(c=>(
                                <button key={c} onClick={()=>toggle(c,selColors,setColors)}
                                        className={`w-6 h-6 rounded-full border-2 ${selColors.includes(c)?'ring-2 ring-offset-1 ring-gray-600':''}`}
                                        style={{ backgroundColor:c }} aria-label={c}/>
                            ))}
                        </div>
                    </div>

                    {/* size */}
                    <div>
                        <h3 className="font-semibold mb-2">Size</h3>
                        <div className="flex flex-wrap gap-2">
                            {sizeOptions.map(s=>(
                                <button key={s} onClick={()=>toggle(s,selSizes,setSizes)}
                                        className={`px-2 py-1 border text-xs ${selSizes.includes(s)?'bg-gray-200':''}`}>{s}</button>
                            ))}
                        </div>
                    </div>

                    {/* condition */}
                    <div>
                        <h3 className="font-semibold mb-2">Condition</h3>
                        {conditionOptions.map(c=>(
                            <label key={c} className="flex items-center mb-1">
                                <input type="checkbox" className="mr-2" checked={selConds.includes(c)}
                                       onChange={()=>toggle(c,selConds,setConds)}/> {c}
                            </label>
                        ))}
                    </div>
                </aside>

                {/* Listings Grid */}
                <main className="flex-1">
                    <h2 className="text-2xl font-semibold mb-4">Shop Products</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pageItems.map(p => {
                            const withoutUser: Product = {
                                ...p,
                                lister: {
                                    avatarUrl: '',
                                    display:   '',
                                    username:  '',
                                }
                            };
                            return <ProductCard
  key={p.id}
  product={withoutUser}
  setExplorePageItems={() => {}}
/>
;
                        })}
                    </div>

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-8" style={{ color: brandNavy }}>
                            <button
                                onClick={()=>setPage(x=>Math.max(1,x-1))}
                                disabled={page === 1}
                                className="px-3 py-1 border disabled:opacity-50"
                            >
                                Previous
                            </button>
                            {[...Array(pages)].map((_,i) => (
                                <button
                                    key={i}
                                    onClick={()=>setPage(i+1)}
                                    className={`px-3 py-1 border ${page===i+1?'bg-gray-200':''}`}
                                >
                                    {i+1}
                                </button>
                            ))}
                            <button
                                onClick={()=>setPage(x=>Math.min(pages,x+1))}
                                disabled={page === pages}
                                className="px-3 py-1 border disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </main>
            </div>

            <Footer />
        </div>
    );
}
