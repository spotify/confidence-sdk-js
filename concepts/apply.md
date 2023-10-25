# Apply

## Context

Confidence has the concept of applying a flag, this means marking the flag as used by a user. From the Confidence documentation:

`"When a flag has been resolved and the value has been used to configure the application, the flag is said to be applied"`

When a flag is marked as applied, that application will populate the data that drives the metrics.

## How to mark a flag as Applied

A flag can be applied one of two ways.

1. When the flag is requested from the backend
2. When the flag is accessed in the code of an application.

These are subtly different, depending on the use-case one is preferred over the other.

## Backend Apply

Applying on flag request introduces no additional work on the application. When the flag is requested from the
Confidence Server it is marked as applied. This is regardless of if the value of the flag was used in the code.

Backend apply is recommended for server applications, as we also recommend requesting a flag every time a flag is used.

## Access Apply

Applying a flag in a client is more nuanced than on a server. All flags available for a clientSecret are resolved on application
load. However, a client may not enter a code path which uses a flag. To combat this and to produce accurate metrics, a
flag is marked as applied when it is accessed. To limit the load on the network of a client, the apply events are batched.
The batching works by collecting all flag accessed in a given timeframe since the last flag access, then sending the apply
results when the timeout is reached.

Access Apply is recommended for client applications, or anywhere using the OpenFeature Static Paradigm.

## Alignment with OpenFeature Paradigms

### Dynamic

In the OpenFeature dynamic paradigm each flag is requested when we access it. It makes sense to only use backend apply
here, as each request is also access of a flag.

### Static

In an OpenFeature static context all flags are requested when `.setContext()` is called this would result in the user
being in the metrics to all flags, regardless of if the flag was accessed in the executed path. Ideally, access apply
should be used to combat this.
