 **CHATBOT**



Visa Rates: --> Long stay (80 days) = 650 Saudi riyal

	Requirements : 1. Confirm Ticket

		       2. Iqama + Saudi address

		       3. Clear passport copy



	Passport processing time: 2 days

	OCR integration: 1. First Name

			 2. Last Name

			 3. Passport Number

			 4. Issue Date

			 5. Expiry Date	

	

        Only visa with transport (30 days max)

		1. 600 Saudi riyal(5-47 passenger)

		2. 650 Saudi riyal(4 passenger)

		3. 675 Saudi riyal(3 passenger)

		4. 700 Saudi riyal(2 passenger)

		5. 790 Saudi riyal(1 passenger)

	requirements: hotel booking



	Only visa without transport (30 days max) --> 550 riyal
			
		90 riyal for any Pakistani airline (640 riyal)

		With first leg transport (transport rates from rate card):


Transport Rates — 1448 H (2026-27) | WEF: 05-Aug-26
Source: Six Sigma Travel Group Official Rate Card

| Route                                                  | Sedan | GMC Yukon XL | Hyundai Staria | Toyota Hiace | Toyota Coaster | Bus (47 Seats) |
|--------------------------------------------------------|-------|--------------|----------------|--------------|----------------|----------------|
| JED-MAK-MED-MAK-JED (Full Package)                    |  1330 |         2320 |           1500 |         1700 |           2700 |           3700 |
| Jeddah to Makkah                                      |   250 |          390 |            280 |          330 |            550 |            800 |
| Makkah to Madinah / Madinah to Makkah                 |   450 |          800 |            500 |          550 |            850 |           1100 |
| Jeddah Airport to Madinah / Madinah to Jeddah Airport |   480 |          830 |            520 |          580 |            900 |           1200 |
| Makkah to Jeddah                                      |   180 |          330 |            220 |          270 |            450 |            700 |
| Mazarat Makkah / Mazarat Madinah                      |   200 |          370 |            250 |          300 |            350 |            400 |
| Madinah Airport ↔ Madinah Hotel                       |   150 |          260 |            200 |          260 |            300 |            450 |
| Jeddah Airport ↔ Jeddah City                          |   180 |          330 |            250 |          280 |            300 |            450 |
| Makkah – Taif Ziarat                                  |   550 |          850 |            600 |          700 |            800 |           1000 |

Notes:
- Additional SR 90 will be charged for Jeddah Hajj Terminal Flights.
- Arrival intimation must be sent before 24 hours.
- 30% will be charged in case of No Show.
- Rates valid up to 15 Shaban 1448.
- Rates subject to change during season without notice.





Above are the rates and requirements mentioned for both visa and transport mentioned. Create a chatbot that is going to be linked to WhatsApp. The Chatbot is created to handle general customer queries and answer questions based on the above mentioned things. If the customer wants to know anything else rather than the above mentioned things he should call on the helpline that is going to be another WhatsApp number. For ticketing queries, another WhatsApp number would be displayed and user would be asked to contact on that number. The admin would check for the current price of the asked ticket and reply manually to the customer.

For a visa query if the customer agrees with the rate the bot should ask the customer to send a clear passport picture. After that, connect an OCR that extracts the following passport details: 1. First Name, 2. Last Name, 3. Passport Number, 4. Issue Date, 5. Expiry Date. The first name and last name should also be translated in Arabic in the message. The message should be sent to the customer to confirm if the details extracted are correct. After it is confirmed, the payment method should be displayed to the customer i.e. bank account or cash. Tell the customer that visa will be processed once payment is cleared. Once payment is done, give the user wait time of 1-2 days for visa processing. Tell him he will receive his visa in a day or two.

Any Pakistani airline flying to Jeddah hajj terminal will be charged extra 90 Saudi riyals along with the visa rate. when 1st leg transport from Jeddah/Madina airport to anywhere(which is mentioned in transport rates card) will be added the user should get the option for which kind of transport he wants. Then upon selection of vehicle type, the final visa rate should be adjusted i.e visa rate + 90 riyal(if arriving on hajj terminal) + vehicle cost. On any other airline no 90 Saudi riyals extra will be charged however 1st leg transport from Jeddah/madina airport to anywhere(which is mentioned in transport rates card) is applicable. This rule only applies if visa without transport is selected. following are the vehicle capacity: Sedan (3-4), GMC (6), Staria (6), Hiace (9), Coaster (17), Bus (47).

In the visa section, when customer confirms number of passengers and is about to upload passport pictures, before doing so ask him for a picture of ticket booking. Check if travel dates are valid (a future date and is less than 30 days for a visa with/without transport). Once validated, then continue with the passport picture process.