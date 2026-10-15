# The service layer -- business logic, agnostic of who's calling. A service never knows it's behind
# HTTP (no Request, no status codes, no FastAPI imports): it raises domain exceptions and the
# controller maps them to a protocol. That's what lets the same logic serve a queue consumer or a
# script later.
#
# It's also agnostic of the STORE: services call repositories in storage-neutral terms and never
# import motor/bson. A mongo-shaped detail leaking into a service signature is a smell.
#
# Not everything needs a service. A pass-through that just forwards to one repo call earns nothing --
# let the controller use the repo directly, and add a service when there's actual logic to hold.
