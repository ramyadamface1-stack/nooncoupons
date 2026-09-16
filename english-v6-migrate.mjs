import fs from 'node:fs';

const path='bulk-content-engine.js';
let s=fs.readFileSync(path,'utf8');

const replacement=` const categoryVoice={
  mobile:[
   \`For mobiles, define the device job before looking at the coupon field. Separate daily communication, photography, gaming and travel needs, then lock the storage tier, regional version, network compatibility and warranty expectation. A phone that misses one of those requirements is not a fair comparison even when its checkout total looks lower. Record the exact model family and capacity so a seller or variant change cannot be mistaken for a coupon effect.\`,
   \`Treat accessories and condition as part of the mobile purchase. Check whether the listing is new or refurbished, which charger or accessories are included, and what return route applies to that seller. When two phone listings differ on those points, keep them as separate candidates. Compare the final payable amount only after the hardware and listing conditions are equivalent enough for your intended use.\`
  ],
  computing:[
   \`For laptops and computing products, freeze the configuration before testing a code. Processor class, memory, storage, display, keyboard layout, operating system and ports can turn two similar product names into different machines. Write down the exact configuration that meets your workload, whether that is study, office work, development, creative tasks or gaming, and reject substitutes that fail a requirement before comparing checkout totals.\`,
   \`Computing value also depends on what is included and what can be upgraded later. Confirm the charger, regional keyboard, warranty path, connectivity and any stated upgrade limits. If a seller switch changes the configuration or support terms, restart the comparison. The coupon experiment should measure the same machine and quantity rather than reward a cheaper but materially different specification.\`
  ],
  audio:[
   \`For headphones and audio gear, start from listening and communication needs: connection type, microphone performance, battery expectations, comfort and isolation. Keep the exact wired or wireless format and device compatibility fixed before testing the cart. A lower total is not automatically better when it changes fit, latency, charging method or the features needed for calls, travel, exercise or gaming.\`,
   \`Check the precise model, codec or connection support, charging accessories and warranty information shown on the listing. Earbuds, headsets and speakers can have very different use cases even inside one search result. Compare coupon outcomes only after the selected audio product genuinely fits the same job and the seller conditions remain stable.\`
  ],
  screen:[
   \`For TVs and displays, the buying decision starts with the room and source devices. Lock screen size, resolution, panel requirements, refresh needs and the ports you actually use. Also note whether a stand, wall mount or special delivery handling matters. These details create a meaningful baseline so a coupon cannot pull the comparison toward a screen that is cheaper but wrong for the space or equipment.\`,
   \`Record the exact model code and regional specification before adding the coupon. Similar display names can hide different panels, ports or included stands. Review seller, delivery and return handling because large displays carry practical risks beyond price. Use the final checkout total only after those product and logistics conditions are close enough to compare.\`
  ],
  fashion:[
   \`For fashion, fit risk matters more than a headline coupon. Start with the size chart, material, cut, color and the return conditions that apply to the exact listing. Keep one intended use in mind, such as work, travel or everyday wear, and reject options that fail that use before testing the code. This prevents a discounted item with the wrong fit from appearing to be the better purchase.\`,
   \`Treat color, size and seller as fixed variables during the cart test. A different size or seller can change availability, delivery and return terms, so it is not the same comparison. Save the exact selected variant, review the product images and material description, then compare final totals between options that you would actually keep if the coupon disappeared.\`
  ],
  beauty:[
   \`For beauty products, identify the exact product type, shade or formulation, pack size and intended routine before looking at the coupon result. A nearby shade, different concentration or alternate size is not a controlled substitute. Record the precise variant and seller, and make suitability the first filter so the checkout test does not turn a product mismatch into apparent savings.\`,
   \`Review the listing description, declared ingredients or usage information when relevant, the sealed-product return conditions and the actual package size. If any of those details change, label it as a new candidate rather than continuing the same coupon test. Compare the payable total only between variants that serve the same routine and have acceptable seller conditions.\`
  ],
  appliance:[
   \`For home appliances, start with capacity, dimensions, power requirements, installation needs and warranty expectations. Measure the available space before comparing totals, because a cheaper appliance that does not fit or requires an unsuitable setup is not a valid alternative. Keep the exact model and capacity fixed while you test the coupon so the cart result stays tied to the same practical requirement.\`,
   \`Delivery, installation and seller support can materially affect an appliance purchase. Record those conditions alongside the product subtotal and shipping shown at checkout. If a different seller changes the warranty route or installation terms, restart the comparison. The final total is useful only after size, compatibility and after-sale conditions pass your baseline.\`
  ],
  kitchen:[
   \`For home and kitchen products, define the cooking or preparation task first. Capacity, dimensions, material, cleaning effort and compatibility with your method of use should stay fixed while testing a coupon. A lower cart total is not a useful result if it comes from a smaller capacity or a material that does not suit the intended daily routine.\`,
   \`Check removable parts, care instructions, exact capacity and what is included in the box. Keep those details and the seller constant during the comparison. If a listing changes from one set size or construction to another, treat it as a separate product choice and compare its final payable amount only after confirming it still meets the same kitchen need.\`
  ],
  home:[
   \`For home products, begin with measurements and room fit. Lock the dimensions, material, color constraints, maintenance expectations and whether assembly is required. A coupon should be tested only after the item is confirmed to suit the intended space; otherwise a lower total can hide the cost and inconvenience of choosing the wrong size or construction.\`,
   \`Record included parts, assembly notes, seller and return practicality before comparing the cart. Furniture, decor and organization products often look interchangeable in search results while differing in measurements or materials. Keep the physical requirements stable and let the checkout total decide only between options that are genuinely usable in the same room.\`
  ],
  grocery:[
   \`For grocery shopping, compare pack size and unit quantity before interpreting any cart change. The useful baseline is the amount you actually need, how it must be stored and whether delivery timing works for that purchase. A different pack count can make the subtotal look better while increasing waste or changing the real unit cost, so keep quantity and pack size visible in your notes.\`,
   \`Use the exact product and pack as the controlled cart item. Check unit description, storage information and the seller or fulfillment context shown by Noon. When comparing alternatives, normalize the quantity first and then review shipping and final payable totals. The coupon result should not be credited for savings created simply by buying a different amount.\`
  ],
  kids:[
   \`For kids products, start with the declared age range, size, material and intended activity. Keep those safety and suitability filters ahead of the coupon test, and use the listing's own guidance rather than guessing that a nearby product is equivalent. A cheaper cart is not a better decision if the item falls outside the age or use range you selected.\`,
   \`Record size, included pieces, seller and return conditions before applying the code. Educational toys, travel items and everyday products can differ substantially even when titles look similar. Compare the final amount only after both options meet the same age, space and use requirements, and restart the test if the variant changes.\`
  ],
  baby:[
   \`For baby products, make fit, cleaning method, material and intended use the first decision gates. Keep the age or size guidance shown on the listing visible and do not substitute a nearby variant just because a coupon accepts it. The cart experiment should follow the product decision, not override it, especially when routine use and cleaning practicality are important.\`,
   \`Confirm the exact size, package contents, care instructions, seller and return information before you compare totals. If the selected variant or age range changes, treat that as a new product choice. Use checkout to compare only candidates that already satisfy the same daily, travel or home-use requirement.\`
  ],
  fitness:[
   \`For sports and fitness products, define the exercise, user level, dimensions and storage limits before testing a coupon. Weight, material and intended use can separate products that look similar in a search list. Keep the selected specification stable so a lower checkout total is not achieved by moving to equipment that cannot support the same workout or available space.\`,
   \`Check the stated dimensions, usage limits, included parts and storage needs, then record the exact seller and quantity. Compare coupon outcomes only between equipment that serves the same exercise goal. If a variant changes resistance, size or construction, restart the decision rather than continuing the old cart comparison.\`
  ],
  travel:[
   \`For travel products, start with trip length, size limits, empty weight, capacity and handling needs. A suitcase or travel accessory that is cheaper after a coupon can still be the wrong choice if it conflicts with the intended journey or transport constraints. Keep dimensions and capacity fixed before testing the code.\`,
   \`Record wheel or handle details, material, seller, warranty and return conditions alongside the final total. Similar luggage names may hide different sizes or sets, so compare exact variants. When the trip requirement changes, create a new comparison rather than mixing results from products designed for different travel jobs.\`
  ],
  auto:[
   \`For automotive accessories, compatibility comes first. Confirm the vehicle model or stated size range, installation method, material and intended function before applying a coupon. A lower total has no value if the accessory does not fit or requires an installation approach you cannot use, so keep the compatibility evidence attached to the cart test.\`,
   \`Record the exact part or accessory variant, included mounting pieces, seller and return conditions. If compatibility or installation instructions differ between listings, do not treat them as identical. Compare final checkout totals only after each option independently passes the fit and use requirements for the same vehicle.\`
  ],
  office:[
   \`For office products, define device compatibility, connection requirements, size and daily workflow before comparing coupon results. A printer, dock, accessory or desk item should solve the same work or study task in both alternatives. Keep ports, dimensions and supported devices fixed so a cheaper listing does not win by removing a requirement that matters.\`,
   \`Check included cables or accessories, seller, warranty support and the exact connection standard shown in the listing. If one option changes the setup you need, label that trade-off clearly instead of calling it pure savings. Use the payable total to compare only office products that remain suitable for the same desk and devices.\`
  ],
  pets:[
   \`For pet supplies, start with the animal type, size, quantity, material and cleaning needs. Keep those practical requirements fixed before testing a coupon because a cheaper item can be unsuitable for the pet or routine. The controlled comparison should use the same intended daily, travel or home use rather than any product that happens to accept the code.\`,
   \`Review the stated size, usage instructions, package quantity, seller and return practicality. If the quantity or target animal changes, it becomes a new comparison. Judge the final checkout total only after the product still fits the same pet and care routine, and record any trade-off instead of hiding it inside a coupon result.\`
  ]
 }[t.profileKey]||[
  \`Define the exact specification, compatibility, seller and return requirements for this ${cat} purchase before testing the coupon. Keep the selected variant stable so checkout changes are measured against the same product decision.\`,
  \`Record included items, delivery conditions and the final payable amount. Treat any material variant change as a new comparison instead of attributing the difference to the code.\`
 ];
 const marketVoice=t.country==='SA' ? [
  \`For a Saudi Arabia test, keep the full experiment inside the Saudi storefront and the delivery context attached to that cart. Record the seller, shipping line and final amount shown for the Saudi checkout before and after the code. If a product page or shared link opens in another market, return to the Saudi context and rebuild the comparison rather than carrying totals across storefronts.\`,
  \`Use the Saudi cart as the dated evidence for this attempt. Availability, seller choices and campaign messages can change between sessions, so note what the checkout actually shows now and avoid presenting an older observation as a standing rule. The article does not infer a Saudi-specific discount percentage; it only explains how to verify the current Saudi transaction.\`
 ] : [
  \`For a UAE test, anchor the experiment to the UAE storefront, delivery location and the seller attached to that cart. Save the shipping line and final amount shown by the UAE checkout before and after entering the code. If a link switches to another Noon market, restart the UAE basket instead of mixing prices, listings or eligibility messages from different storefronts.\`,
  \`Treat the current UAE checkout as the dated commercial evidence. Seller availability, delivery choices and campaign messages can change, so capture the result you can observe now and avoid turning a previous session into a permanent rule. This guide does not invent a UAE discount percentage; it explains how to verify the live UAE purchase conditions.\`
 ];
 const intentVoice={
  coupon:[
   \`A coupon search is a verification task. Establish a pre-code baseline, apply ${t.code} once, and classify the result as accepted, rejected or unclear based on the checkout message and payable total. Do not change product, seller or quantity between those two observations. If anything else changes, discard the pair and run a fresh test rather than assigning the difference to the coupon.\`,
   \`After acceptance, inspect what changed instead of stopping at the success message. Write down subtotal, shipping, visible cart adjustments and final payable total. If the code is rejected, preserve the rejection message and simplify the cart before another attempt. This workflow produces useful evidence without promising a fixed percentage or universal eligibility.\`,
   \`For a second coupon attempt, change one variable only and label it. That can be quantity, seller or one additional item, but not several conditions together. A controlled sequence makes it possible to see which cart change coincides with a different outcome and prevents an unrelated price movement from being described as coupon savings.\`
  ],
  finalprice:[
   \`A final-price search should be solved with a cost sheet, not a coupon headline. Record the exact item subtotal first, then shipping and every visible checkout adjustment, and finish with the payable total. If a line is not shown by Noon, leave it out rather than estimating it. The objective is the amount required for this exact cart, not a theoretical discount.\`,
   \`Build two complete totals when comparing alternatives. Keep product specifications equivalent enough to serve the same need, then compare the whole payable amount for each cart. A lower item price can lose its advantage after shipping or seller differences, while an accepted coupon may still leave the other option cheaper.\`,
   \`Recalculate whenever price, seller, quantity or delivery method changes. Do not reuse an old total after the cart has moved. The final-price method is intentionally transactional: the current checkout is the reference, and the article avoids turning a temporary amount into a lasting market claim.\`
  ],
  eligibility:[
   \`Eligibility is a diagnostic question, not a promise that a shopper qualifies. Start with one item and the exact code, observe the message Noon returns, and keep the account and storefront context unchanged. If the result is accepted, add other items one by one; if it is rejected, stop and review the current campaign information shown by Noon before guessing at a cause.\`,
   \`Create a small decision tree from observable outcomes. Accepted means you can continue checking the final total. Rejected means the current cart did not accept the code under those conditions. Unclear means you need a cleaner one-item test. None of those outcomes proves a universal rule for other accounts, products or future sessions.\`,
   \`When testing a possible eligibility factor, change only that factor. This can help identify an association between a cart condition and the result without claiming a reason Noon has not published. Keep screenshots or notes of the checkout wording if you need to compare attempts, and let the newest visible condition override an older assumption.\`
  ],
  timing:[
   \`Timing content should answer when a recheck is justified. Useful triggers include a new shopping session, a seller change, a visible price change, a different delivery option or newly displayed campaign terms. Repeatedly refreshing an unchanged cart does not create meaningful new evidence, so wait for a real commercial condition to change before recording another observation.\`,
   \`Use dated observations instead of phrases such as always or today unless you are actually verifying that session. Write down the cart state, the code result and the final total, then compare the next check against the same variables. This turns timing into a record of changed conditions rather than speculation about when a discount will appear.\`,
   \`A timing decision is also a buying decision. If the current item already meets the need and the payable total is acceptable, decide whether waiting has a real benefit to you. If you do wait, define what would make you recheck—price, seller, delivery or campaign information—so the next test has a reason and a comparable baseline.\`
  ],
  smartbuy:[
   \`Smart buying begins by separating need, listing quality, transaction risk and cost. Score the product against the job first, then review seller, delivery and return conditions, and only then look at the final total. The coupon is one input in that sequence. It should never compensate for a product that fails a must-have requirement.\`,
   \`Use a short decision matrix with pass, trade-off and reject states. A pass meets the requirement; a trade-off is acceptable but should be recorded; a reject removes the option before price comparison. This prevents a small checkout change from receiving more weight than compatibility, fit, warranty or another category-specific requirement.\`,
   \`When two candidates survive the matrix, compare their complete checkout totals and note why the winner fits the intended use. If the result depends on ${t.code}, keep the code outcome as a separate line in the decision record. That makes the reasoning still useful if coupon eligibility changes later.\`
  ],
  value:[
   \`Value analysis compares what you receive with what you finally pay. First identify two products that satisfy the same essential requirement, then list the meaningful differences in specification, seller, delivery and returns. Only after that should you compare checkout totals. A cheaper but less suitable option is a trade-off, not automatic savings.\`,
   \`Use a comparable alternative as the reference instead of an imaginary full price. If one cart costs less because the product has a smaller size, lower specification or different package quantity, isolate that difference and do not credit it to the coupon. Real value requires both a defensible product comparison and a verified payable amount.\`,
   \`Record what you would choose if the coupon disappeared. If that answer changes only because ${t.code} is accepted, check whether the product trade-off is still acceptable. This keeps the value decision focused on utility and total cost rather than turning coupon acceptance into the goal of the purchase.\`
  ],
  cart:[
   \`A cart experiment works by isolation. Begin with one suitable item, one seller and one quantity, record the baseline total, then apply ${t.code}. After you save the outcome, add or change a single cart element. Each step should have one clear variable so a different coupon result can be tied to an observable cart change rather than a cluster of edits.\`,
   \`Maintain a simple cart log: step number, item state, seller, quantity, shipping, code message and final total. If several variables change at once, mark that step invalid and return to the last controlled state. This approach is especially useful for mixed baskets where one added item may coincide with a different checkout response.\`,
   \`Stop the experiment when you have enough information to make the purchase decision. The purpose is not to force acceptance through endless cart edits. If the code stays rejected, compare the suitable products without it or revisit the current Noon campaign information. A clean negative result is more useful than an uncontrolled positive one.\`
  ]
 }[t.intent]||[
  \`Use a repeatable checkout method for this search intent: stabilize the product choice, observe the current cart, change one variable and record the result.\`,
  \`Keep product suitability separate from coupon acceptance and use the final payable total as the commercial reference for the current session.\`,
  \`If the cart changes materially, start a new comparison rather than extending an old conclusion beyond its evidence.\`
 ];
 const sections=[
  p(\`Category baseline for ${cat}\`,categoryVoice[0],categoryVoice[1]),
  p(t.country==='SA'?'Saudi checkout evidence':'UAE checkout evidence',marketVoice[0],marketVoice[1]),
  p(\`${intentLens[0]} method: establish the evidence\`,intentVoice[0],intentVoice[1]),
  p(\`${intentLens[0]} method: make the decision\`,intentVoice[2],\`Apply this method to ${cat} in ${market} without importing a result from another product, account or storefront. Keep ${t.code} as a testable input and let the current checkout decide what is actually true for this cart.\`),
  p('Seller and transaction controls',\`Keep seller, quantity, selected variant and delivery option visible in your notes. If one changes, label the new state before comparing totals. This prevents a seller switch or shipping change from being mistaken for a coupon effect.\`,\`Review return and warranty information that matters to this ${cat} purchase before payment. A lower final amount is useful only when the transaction conditions remain acceptable for the same intended use.\`),
  p('No unsupported savings claim',\`Do not infer a percentage from a success message and do not reuse an amount from another session. Record only the adjustment and payable total currently shown by Noon. If the checkout does not display a claimed saving, this article does not invent one.\`,\`When you compare alternatives, use complete current totals and comparable products. That keeps the recommendation grounded in observable cart evidence rather than a marketing number that may not apply to this account.\`),
  p('Controlled troubleshooting',\`If the code is rejected, confirm the ${market} storefront and exact code first. Reduce the basket to one suitable ${cat} item, record the response, then add other items one at a time only if another test is useful.\`,\`If rejection continues, make the buying decision without assuming a hidden cause. Review current Noon campaign information, compare another suitable product or proceed without the coupon when the final transaction still makes sense.\`),
  p('Before payment checklist',\`Confirm the exact product or variant, seller, quantity, delivery condition, return requirements and final payable total. Then decide whether the item still meets the original need without giving the coupon extra weight.\`,\`Copy ${t.code} when you are ready to test it, but keep the checkout total and product fit at the center of the decision. If either changes materially, refresh the comparison rather than carrying forward the old result.\`),
  p('Editorial method and source transparency',\`NoonCoupons treats coupon outcomes as variable checkout observations. The current Noon cart is the final commercial reference for price and eligibility, while this article explains a repeatable way to observe that result without promising a fixed discount.\`,\`The commercial source is Noon's official website. We separate product selection, seller conditions and coupon outcome so the page remains useful even when a campaign changes. Current checkout evidence takes priority over static wording.\`)
 ];
 const table=`;

const re=/ const sections=\[[\s\S]*?\n \];\n const table=/;
if(!re.test(s))throw new Error('EN_V6_SECTIONS_BLOCK_NOT_FOUND');
s=s.replace(re,replacement);
s=s.replace("blueprint:'english-'+(t.intent||'commercial')+'-v5'","blueprint:'english-'+(t.intent||'commercial')+'-v6'");
s=s.replace('englishArticleBuilder:5','englishArticleBuilder:6');
if(!s.includes("english-'+(t.intent||'commercial')+'-v6"))throw new Error('EN_V6_BLUEPRINT_NOT_APPLIED');
if(!s.includes('englishArticleBuilder:6'))throw new Error('EN_V6_INFO_NOT_APPLIED');
fs.writeFileSync(path,s);
console.log('ENGLISH_V6_MIGRATION=APPLIED');
