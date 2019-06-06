using Newtonsoft.Json.Linq;
using OpenFin.FDC3.Constants;
using OpenFin.FDC3.Context;
using OpenFin.FDC3.Intents;
using OpenFin.FDC3.Payloads;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Openfin.Desktop.Messaging;
using Openfin.Desktop;
using OpenFin.FDC3.Channels;

namespace OpenFin.FDC3
{
    internal static class Connection
    {
        internal static Action<Exception> ConnectionInitializationComplete;
        private static ChannelClient channelClient;
        private static Action<ChannelChangedPayload> channelChangedHandlers;
        private static Action<ContextBase> contextListeners;
        private static Dictionary<string, Action<ContextBase>> intentListeners;
        internal static void AddChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            channelChangedHandlers += handler;
        }

        internal static void AddContextListener(Action<ContextBase> handler)
        {
            contextListeners += handler;
        }

        internal static void AddIntentListener(string intent, Action<ContextBase> handler)
        {
            foreach(var key in intentListeners.Keys)
            {
                Action<ContextBase> action;

                if(intentListeners.TryGetValue(key, out action))
                {
                    intentListeners[intent] += handler;
                    break;
                }
            }

            intentListeners.Add(intent, handler);
        }

        internal static Task Broadcast(Context.ContextBase context)
        {
            return channelClient.DispatchAsync<Task>(ApiTopic.Broadcast, context);
        }

        internal static Task<AppIntent> FindIntentAsync(string intent, ContextBase context)
        {
            return channelClient.DispatchAsync<AppIntent>(ApiTopic.FindIntent, new { intent, context });
        }

        internal static Task<AppIntent[]> FindIntentsByContextAsync(ContextBase context)
        {
            return channelClient.DispatchAsync<AppIntent[]>(ApiTopic.FindIntentsByContext, new { context });
        }

        internal static Task<Channel[]> GetAllChannels()
        {
            return channelClient.DispatchAsync<Channel[]>(ApiTopic.GetAllChannels, JValue.CreateUndefined());
        }

        internal static Task<Channel> GetChannelAsync(Identity identity)
        {
            if (identity == null)
            {
                return channelClient.DispatchAsync<Channel>(ApiTopic.GetChannel, new { identity = JValue.CreateUndefined() });
            }
            else
            {
                return channelClient.DispatchAsync<Channel>(ApiTopic.GetChannel, new { identity });
            }
        }

        internal static Task<Identity[]> GetChannelMembersAsync(string id)
        {
            return channelClient.DispatchAsync<Identity[]>(ApiTopic.GetChannelMembers, new { id });
        }

        internal static void Initialize(Runtime runtimeInstance)
        {
            intentListeners = new Dictionary<string, Action<ContextBase>>();
            channelClient = runtimeInstance.InterApplicationBus.Channel.CreateClient(Fdc3ServiceConstants.ServiceChannel);

            registerChannelTopics();
            
            channelClient.ConnectAsync().ContinueWith(x =>
            {
                if (x.Exception == null)
                    ConnectionInitializationComplete?.Invoke(x.Exception);              
            });
        }
        internal static Task JoinChannelAsync(string id, Identity identity)
        {
            return channelClient.DispatchAsync(ApiTopic.JoinChannel, new { id, identity });
        }
        internal static Task OpenAsync(string name, ContextBase context = null)
        {
            return channelClient.DispatchAsync<string>(ApiTopic.Open, new { name, context });
        }
        internal static Task<IntentResolution> RaiseIntent(string intent, ContextBase context, string target)
        {
            return channelClient.DispatchAsync<IntentResolution>(ApiTopic.RaiseIntent, new { intent, context, target });
        }

        internal static void RemoveChannelChangedEventListener(Action<ChannelChangedPayload> handler)
        {
            channelChangedHandlers -= handler;
        }
        internal static void UnsubcribeContextListener(Action<ContextBase> handler)
        {
            contextListeners -= handler;
        }
        internal static void UnsubscribeIntentListener(string intent)
        {
            if(intentListeners.ContainsKey(intent))
            {
                intentListeners.Remove(intent);
            }            
        }

        internal static void UnsubscribeIntentListener(string intent, Action<ContextBase> handler)
        {
            if(intentListeners.ContainsKey(intent))
            {
                intentListeners[intent] -= handler;
            }            
        }
        private static void registerChannelTopics()
        {
            if (channelClient == null)
            {
                throw new NullReferenceException("ChannelClient must be created before registering topics.");
            }

            channelClient.RegisterTopic<RaiseIntentPayload>(ChannelTopicConstants.Intent, payload =>
            {
                if(intentListeners.ContainsKey(payload.Intent))
                {
                    intentListeners[payload.Intent].Invoke(payload.Context);
                }                
            });

            channelClient.RegisterTopic<ContextBase>(ChannelTopicConstants.Context, payload =>
            {
                contextListeners?.Invoke(payload);                
            });

            channelClient.RegisterTopic<ChannelChangedPayload>(ChannelTopicConstants.Event, @event =>
            {
                channelChangedHandlers?.Invoke(@event);                
            });
        }
    }
}