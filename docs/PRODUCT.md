# Product requirements — Trippy Corporate Mobility

## Product promise

A safe, comfortable, reliable fixed-route office commute for people travelling within Dhaka: monthly reserved seats in a verified bus, Hiace or shared private car, with defined morning inbound and evening return trips. Not on-demand taxi dispatch.

## Riders

1. Find a home-area corridor and office-area corridor; review approved boarding/drop-off stops.
2. Choose the morning and evening scheduled service and the same numbered passenger seat shown on the actual verified vehicle floorplan.
3. Choose a 1-, 3-, 6- or 12-month prepaid term; display server-calculated total and non-stackable discount.
4. Verify phone OTP, pay through a hosted provider, then receive a confirmed reservation only after independent payment validation.
5. See only authorized active trip locations, reach support, and submit demand for a full route.

## Operations

- Register actual vehicles; inspect seating, exits, fitness, insurance and approved capacity.
- Vet and approve drivers; map specific vehicles to routes and stop order.
- Publish morning pickup, office drop-off and evening return, with approved calendars and notices.
- Review full-seat demand and add legal verified vehicles, not imaginary inventory.
- Manage payment exceptions and support/safety requests with auditable actions.

## Commercial rules

| Class | Monthly fare | 1-month new rider | 3-month prepay | 6-month prepay | 12-month prepay |
|---|---:|---:|---:|---:|---:|
| Bus | ৳5,000 | ৳4,000 | ৳11,250 | ৳21,000 | ৳39,000 |
| Hiace | ৳6,500 | ৳5,200 | ৳14,625 | ৳27,300 | ৳50,700 |
| Shared car | ৳8,000 | ৳6,400 | ৳18,000 | ৳33,600 | ৳62,400 |

The first-month 20% offer is for the first paid one-month subscription, while the longer prepay terms discount the full prepayment independently. Discounts cannot be combined. Proration, refunds, route cancellation policy, taxation and renewal are commercial decisions awaiting business approval; the system must not silently invent them.

## Pilot acceptance criteria (must be demonstrated on real devices)

- No overbooking from simultaneous passengers, including time-bound holds and payment races.
- Exact physical floorplan matches each vehicle's inspected seating and excludes driver, emergency exits and inaccessible positions.
- Failure/timeout in OTP, merchant callback, GPS, or network does not silently confirm a seat.
- Access permissions prevent riders from viewing other riders' personal data or off-window vehicle locations.
- Safety escalation contact and customer-service response procedure exist before taking money.
